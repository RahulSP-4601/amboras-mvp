import { createHash } from "node:crypto";

import { z } from "zod";

import {
  generationResponseSchema,
  type GenerationResponse,
} from "@/lib/domain/generation-result";
import { enforceAiRequestLimit } from "@/lib/ai/request-guard";
import { generationJobDisposition } from "@/lib/domain/generation-claim";
import {
  generationStageSchema,
  type GenerationStage,
} from "@/lib/domain/generation-stage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const jobRowSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
  attempt_count: z.number().int().min(0),
  result: z.unknown().nullable(),
  started_at: z.string().datetime({ offset: true }).nullable(),
  input_hash: z.string().length(64).nullable(),
  current_stage: z.string(),
});
const claimedAttemptSchema = z.object({
  id: z.string().uuid(),
  attempt_count: z.number().int().positive(),
  started_at: z.string().datetime({ offset: true }),
});

export interface GenerationJob {
  client: ReturnType<typeof createAdminClient>;
  id: string;
  userId: string;
  attemptCount: number;
  startedAt: string;
  stagedResult: GenerationResponse | null;
}

export type GenerationClaim =
  | { kind: "claimed"; job: GenerationJob }
  | { kind: "replay"; result: GenerationResponse };

export class GenerationClaimError extends Error {
  constructor(
    message: string,
    readonly code:
      "in_progress" | "attempts_exhausted" | "key_conflict" | "store_exists",
  ) {
    super(message);
  }
}

export class GenerationAuthenticationError extends Error {}

export async function claimGenerationJob(
  idempotencyKey: string,
  inputSummary: string,
): Promise<GenerationClaim> {
  const authClient = await createClient();
  const { data: auth, error: authError } = await authClient.auth.getUser();
  if (authError) {
    throw new Error("Authentication service is unavailable", {
      cause: authError,
    });
  }
  if (!auth.user) {
    throw new GenerationAuthenticationError("Authentication is required");
  }

  const client = createAdminClient();
  const { error: profileError } = await client.from("profiles").upsert({
    id: auth.user.id,
    display_name:
      typeof auth.user.user_metadata?.full_name === "string"
        ? auth.user.user_metadata.full_name
        : null,
  });
  if (profileError) throw new Error("Profile could not be prepared");

  const inputHash = createHash("sha256").update(inputSummary).digest("hex");
  const existing = await findJob(client, auth.user.id, idempotencyKey);
  if (existing)
    return resolveExisting(
      client,
      auth.user.id,
      existing,
      idempotencyKey,
      inputHash,
    );
  await assertNoOwnedStore(client, auth.user.id);
  await enforceAiRequestLimit(client, auth.user.id, "generation");
  return insertJob(
    client,
    auth.user.id,
    idempotencyKey,
    inputSummary,
    inputHash,
  );
}

type AdminClient = ReturnType<typeof createAdminClient>;
type JobRow = z.infer<typeof jobRowSchema>;

async function findJob(
  client: AdminClient,
  userId: string,
  idempotencyKey: string,
): Promise<JobRow | null> {
  const { data, error } = await client
    .from("ai_jobs")
    .select(
      "id,status,attempt_count,result,started_at,input_hash,current_stage",
    )
    .eq("user_id", userId)
    .eq("job_type", "store_generation")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (error) throw new Error("Generation job could not be read");
  return data ? jobRowSchema.parse(data) : null;
}

async function insertJob(
  client: AdminClient,
  userId: string,
  idempotencyKey: string,
  inputSummary: string,
  inputHash: string,
): Promise<GenerationClaim> {
  const startedAt = new Date().toISOString();
  const { data, error } = await client
    .from("ai_jobs")
    .insert({
      user_id: userId,
      job_type: "store_generation",
      status: "running",
      current_stage: "preparing_store_brief",
      idempotency_key: idempotencyKey,
      attempt_count: 1,
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      prompt_version: "store-generation-v1",
      schema_version: "store-config-v1",
      input_summary: inputSummary.slice(0, 500),
      input_hash: inputHash,
      started_at: startedAt,
    })
    .select("id,attempt_count,started_at")
    .single();
  if (!error && data) {
    const row = claimedAttemptSchema.parse(data);
    return {
      kind: "claimed",
      job: claimedGenerationJob(client, userId, row, null),
    };
  }
  if (error?.code !== "23505")
    throw new Error("Generation job could not be created");
  const existing = await findJob(client, userId, idempotencyKey);
  if (!existing) {
    throw new GenerationClaimError(
      "Another generation is already active",
      "in_progress",
    );
  }
  return resolveExisting(client, userId, existing, idempotencyKey, inputHash);
}

async function resolveExisting(
  client: AdminClient,
  userId: string,
  row: JobRow,
  idempotencyKey: string,
  inputHash: string,
): Promise<GenerationClaim> {
  assertMatchingInput(row, inputHash);
  const disposition = dispositionFor(row);
  if (disposition === "replay") {
    return {
      kind: "replay",
      result: generationResponseSchema.parse(row.result),
    };
  }
  if (disposition === "restart") {
    return resolveRestart(client, userId, row, idempotencyKey, inputHash);
  }
  if (disposition === "exhausted" && row.status === "running") {
    return resolveExpiredAttempt(
      client,
      userId,
      row,
      idempotencyKey,
      inputHash,
    );
  }
  throwDisposition(disposition);
}

async function resolveExpiredAttempt(
  client: AdminClient,
  userId: string,
  row: JobRow,
  idempotencyKey: string,
  inputHash: string,
): Promise<GenerationClaim> {
  const expired = await expireAttempt(client, row);
  if (expired) {
    throw new GenerationClaimError(
      "Generation retry limit reached",
      "attempts_exhausted",
    );
  }
  const latest = await findJob(client, userId, idempotencyKey);
  if (!latest) throw new Error("Generation attempt could not be expired");
  return resolveExisting(client, userId, latest, idempotencyKey, inputHash);
}

async function expireAttempt(client: AdminClient, row: JobRow) {
  let query = client
    .from("ai_jobs")
    .update({
      status: "failed",
      current_stage: "failed",
      error_code: "attempts_exhausted",
      completed_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("status", "running")
    .eq("attempt_count", row.attempt_count);
  if (row.started_at) query = query.eq("started_at", row.started_at);
  const { data, error } = await query.select("id").maybeSingle();
  if (error) throw new Error("Generation attempt could not be expired");
  return Boolean(data);
}

async function resolveRestart(
  client: AdminClient,
  userId: string,
  row: JobRow,
  idempotencyKey: string,
  inputHash: string,
): Promise<GenerationClaim> {
  await enforceAiRequestLimit(client, userId, "generation");
  const attempt = await restartJob(client, row);
  if (attempt) {
    return {
      kind: "claimed",
      job: claimedGenerationJob(
        client,
        userId,
        attempt,
        parseStagedResult(row.result),
      ),
    };
  }
  const latest = await findJob(client, userId, idempotencyKey);
  if (!latest) throw new Error("Generation retry could not be recovered");
  return resolveExisting(client, userId, latest, idempotencyKey, inputHash);
}

function assertMatchingInput(row: JobRow, inputHash: string) {
  if (!row.input_hash || row.input_hash === inputHash) return;
  throw new GenerationClaimError(
    "Idempotency key was used for different input",
    "key_conflict",
  );
}

function dispositionFor(row: JobRow) {
  return generationJobDisposition(
    {
      status: row.status,
      attemptCount: row.attempt_count,
      startedAt: row.started_at,
    },
    Date.now(),
  );
}

function throwDisposition(
  disposition: ReturnType<typeof generationJobDisposition>,
): never {
  if (disposition === "exhausted") {
    throw new GenerationClaimError(
      "Generation retry limit reached",
      "attempts_exhausted",
    );
  }
  throw new GenerationClaimError(
    "A matching generation is already active",
    "in_progress",
  );
}

async function restartJob(
  client: AdminClient,
  row: JobRow,
): Promise<z.infer<typeof claimedAttemptSchema> | null> {
  const startedAt = new Date().toISOString();
  let query = client
    .from("ai_jobs")
    .update({
      status: "running",
      current_stage: "generating_storefront",
      attempt_count: row.attempt_count + 1,
      error_code: null,
      started_at: startedAt,
      completed_at: null,
    })
    .eq("id", row.id)
    .eq("status", row.status);
  if (row.started_at) query = query.eq("started_at", row.started_at);
  const { data, error } = await query
    .select("id,attempt_count,started_at")
    .maybeSingle();
  if (error?.code === "23505") {
    throw new GenerationClaimError(
      "Another generation is already active",
      "in_progress",
    );
  }
  if (error) throw new Error("Generation retry could not be claimed");
  return data ? claimedAttemptSchema.parse(data) : null;
}

function parseStagedResult(value: unknown): GenerationResponse | null {
  if (value === null) return null;
  return generationResponseSchema.parse(value);
}

export async function saveGenerationOutput(
  job: GenerationJob,
  result: Omit<GenerationResponse, "persisted">,
) {
  const { data, error } = await job.client
    .from("ai_jobs")
    .update({
      current_stage: "saving_draft_version",
      result: { ...result, persisted: null },
    })
    .eq("id", job.id)
    .eq("status", "running")
    .eq("attempt_count", job.attemptCount)
    .eq("started_at", job.startedAt)
    .select("id")
    .single();
  if (error || !data) throw new Error("Generation output could not be staged");
}

export async function updateGenerationStage(
  job: GenerationJob,
  stage: GenerationStage,
) {
  const { data, error } = await job.client
    .from("ai_jobs")
    .update({ current_stage: stage })
    .eq("id", job.id)
    .eq("status", "running")
    .eq("attempt_count", job.attemptCount)
    .eq("started_at", job.startedAt)
    .select("id")
    .maybeSingle();
  if (error || !data) throw new Error("Generation stage could not be saved");
}

export async function getGenerationJobStage(idempotencyKey: string) {
  const authClient = await createClient();
  const { data: auth, error: authError } = await authClient.auth.getUser();
  if (authError) {
    throw new Error("Authentication service is unavailable", {
      cause: authError,
    });
  }
  if (!auth.user) {
    throw new GenerationAuthenticationError("Authentication is required");
  }
  const row = await findJob(createAdminClient(), auth.user.id, idempotencyKey);
  return generationStageSchema.safeParse(row?.current_stage).data ?? null;
}

export async function failGenerationJob(job: GenerationJob) {
  const { error } = await job.client
    .from("ai_jobs")
    .update({
      status: "failed",
      current_stage: "failed",
      error_code: "generation_failed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "running")
    .eq("attempt_count", job.attemptCount)
    .eq("started_at", job.startedAt);
  if (error) throw new Error("Generation job status could not be saved");
}

async function assertNoOwnedStore(client: AdminClient, userId: string) {
  const { data, error } = await client
    .from("stores")
    .select("id")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Existing store could not be checked");
  if (data) {
    throw new GenerationClaimError(
      "This merchant already has a store",
      "store_exists",
    );
  }
}

function claimedGenerationJob(
  client: AdminClient,
  userId: string,
  attempt: z.infer<typeof claimedAttemptSchema>,
  stagedResult: GenerationResponse | null,
): GenerationJob {
  return {
    client,
    id: attempt.id,
    userId,
    attemptCount: attempt.attempt_count,
    startedAt: attempt.started_at,
    stagedResult,
  };
}
