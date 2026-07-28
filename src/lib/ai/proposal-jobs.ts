import "server-only";

import { createHash } from "node:crypto";

import { z } from "zod";

import { enforceAiRequestLimit } from "@/lib/ai/request-guard";
import { generationJobDisposition } from "@/lib/domain/generation-claim";
import {
  storeEditProposalSchema,
  type StoreEditProposal,
} from "@/lib/domain/store-edit";
import { createAdminClient } from "@/lib/supabase/admin";

const rowSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
  attempt_count: z.number().int(),
  result: z.unknown().nullable(),
  input_hash: z.string().length(64).nullable(),
  started_at: z.string().datetime({ offset: true }).nullable(),
});
const resultSchema = z.object({ proposal: storeEditProposalSchema }).strict();
const claimedAttemptSchema = z.object({
  id: z.string().uuid(),
  attempt_count: z.number().int().positive(),
  started_at: z.string().datetime({ offset: true }),
});
type AdminClient = ReturnType<typeof createAdminClient>;
type JobRow = z.infer<typeof rowSchema>;

export interface ProposalJob {
  client: AdminClient;
  id: string;
  attemptCount: number;
  startedAt: string;
}

export type ProposalClaim =
  | { kind: "claimed"; job: ProposalJob }
  | { kind: "replay"; proposal: StoreEditProposal };

export class ProposalJobError extends Error {
  constructor(
    message: string,
    readonly code: "in_progress" | "exhausted" | "key_conflict" | "not_owned",
  ) {
    super(message);
  }
}

export async function claimProposalJob(input: {
  userId: string;
  storeId: string;
  idempotencyKey: string;
  inputSummary: string;
}): Promise<ProposalClaim> {
  const client = createAdminClient();
  await assertOwnership(client, input.userId, input.storeId);
  const inputHash = hash(input.inputSummary);
  const existing = await findJob(client, input.userId, input.idempotencyKey);
  if (existing) {
    return resolveExisting(client, existing, input, inputHash);
  }
  await enforceAiRequestLimit(client, input.userId, "proposal");
  return insertJob(client, input, inputHash);
}

async function resolveExisting(
  client: AdminClient,
  row: JobRow,
  input: Parameters<typeof claimProposalJob>[0],
  inputHash: string,
): Promise<ProposalClaim> {
  if (row.input_hash !== inputHash) {
    throw new ProposalJobError(
      "Key was used for different input",
      "key_conflict",
    );
  }
  const disposition = generationJobDisposition(
    {
      status: row.status,
      attemptCount: row.attempt_count,
      startedAt: row.started_at,
    },
    Date.now(),
  );
  if (disposition === "replay") {
    return {
      kind: "replay",
      proposal: resultSchema.parse(row.result).proposal,
    };
  }
  if (disposition === "exhausted" && row.status === "running") {
    return resolveExpiredAttempt(client, row, input, inputHash);
  }
  if (disposition !== "restart") throwDisposition(disposition);
  await enforceAiRequestLimit(client, input.userId, "proposal");
  return restartJob(client, row);
}

async function resolveExpiredAttempt(
  client: AdminClient,
  row: JobRow,
  input: Parameters<typeof claimProposalJob>[0],
  inputHash: string,
): Promise<ProposalClaim> {
  const expired = await expireAttempt(client, row);
  if (expired) {
    throw new ProposalJobError("Proposal retry limit reached", "exhausted");
  }
  const latest = await findJob(client, input.userId, input.idempotencyKey);
  if (!latest) throw new Error("Proposal attempt could not be expired");
  return resolveExisting(client, latest, input, inputHash);
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
  if (error) throw new Error("Proposal attempt could not be expired");
  return Boolean(data);
}

async function insertJob(
  client: AdminClient,
  input: Parameters<typeof claimProposalJob>[0],
  inputHash: string,
): Promise<ProposalClaim> {
  const { data, error } = await client
    .from("ai_jobs")
    .insert(jobInsert(input, inputHash))
    .select("id,attempt_count,started_at")
    .single();
  if (error?.code === "23505") {
    const existing = await findJob(client, input.userId, input.idempotencyKey);
    if (existing) return resolveExisting(client, existing, input, inputHash);
    throw new ProposalJobError("Another proposal is active", "in_progress");
  }
  if (error || !data) throw new Error("Proposal job could not be created");
  return { kind: "claimed", job: proposalJob(client, data) };
}

async function restartJob(
  client: AdminClient,
  row: JobRow,
): Promise<ProposalClaim> {
  let query = client
    .from("ai_jobs")
    .update({
      status: "running",
      current_stage: "generating_proposal",
      attempt_count: row.attempt_count + 1,
      started_at: new Date().toISOString(),
      completed_at: null,
      error_code: null,
    })
    .eq("id", row.id)
    .eq("status", row.status);
  if (row.started_at) query = query.eq("started_at", row.started_at);
  const { data, error } = await query
    .select("id,attempt_count,started_at")
    .maybeSingle();
  if (error?.code === "23505") {
    throw new ProposalJobError("Another proposal is active", "in_progress");
  }
  if (error || !data)
    throw new ProposalJobError("Proposal is active", "in_progress");
  return { kind: "claimed", job: proposalJob(client, data) };
}

export async function completeProposalJob(
  job: ProposalJob,
  proposal: StoreEditProposal,
) {
  const { data, error } = await job.client
    .from("ai_jobs")
    .update({
      status: "succeeded",
      current_stage: "proposal_ready",
      result: { proposal },
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "running")
    .eq("attempt_count", job.attemptCount)
    .eq("started_at", job.startedAt)
    .select("id")
    .maybeSingle();
  if (error || !data) throw new Error("Proposal job could not be completed");
}

export async function failProposalJob(job: ProposalJob) {
  await job.client
    .from("ai_jobs")
    .update({
      status: "failed",
      current_stage: "failed",
      error_code: "proposal_failed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "running")
    .eq("attempt_count", job.attemptCount)
    .eq("started_at", job.startedAt);
}

async function findJob(
  client: AdminClient,
  userId: string,
  key: string,
): Promise<JobRow | null> {
  const { data, error } = await client
    .from("ai_jobs")
    .select("id,status,attempt_count,result,input_hash,started_at")
    .eq("user_id", userId)
    .eq("job_type", "store_edit")
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error) throw new Error("Proposal job could not be read");
  return data ? rowSchema.parse(data) : null;
}

async function assertOwnership(
  client: AdminClient,
  userId: string,
  storeId: string,
) {
  const { data, error } = await client
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error || !data) {
    throw new ProposalJobError("Store is not owned", "not_owned");
  }
}

function jobInsert(
  input: Parameters<typeof claimProposalJob>[0],
  inputHash: string,
) {
  const startedAt = new Date().toISOString();
  return {
    user_id: input.userId,
    store_id: input.storeId,
    job_type: "store_edit",
    status: "running",
    current_stage: "generating_proposal",
    idempotency_key: input.idempotencyKey,
    attempt_count: 1,
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    prompt_version: "store-edit-v1",
    schema_version: "store-edit-proposal-v1",
    input_summary: input.inputSummary.slice(0, 500),
    input_hash: inputHash,
    started_at: startedAt,
  };
}

function throwDisposition(
  value: ReturnType<typeof generationJobDisposition>,
): never {
  if (value === "exhausted") {
    throw new ProposalJobError("Proposal retry limit reached", "exhausted");
  }
  throw new ProposalJobError("A proposal is already active", "in_progress");
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function proposalJob(client: AdminClient, value: unknown): ProposalJob {
  const attempt = claimedAttemptSchema.parse(value);
  return {
    client,
    id: attempt.id,
    attemptCount: attempt.attempt_count,
    startedAt: attempt.started_at,
  };
}
