import "client-only";

import { z } from "zod";

import { generationResponseSchema } from "@/lib/domain/generation-result";
import { productInputSchema } from "@/lib/domain/product";
import { storeConfigSchema, type StoreConfig } from "@/lib/domain/store-config";
import {
  storeEditProposalSchema,
  type StoreEditProposal,
} from "@/lib/domain/store-edit";
import {
  storeDraftMutationSchema,
  type DraftRecord,
  type StoreDraftMutation,
} from "@/lib/domain/store-workspace";

const proposalKeys = new Map<string, string>();
const versionMutationKeys = new Map<string, string>();

export async function requestDraft(
  draft: DraftRecord,
  config: StoreConfig,
  source: "manual_edit" | "ai_edit",
) {
  if (!draft.persisted) throw new Error("Persisted draft is required");
  return requestVersion("/api/store/draft", {
    storeId: draft.persisted.storeId,
    parentVersionId: draft.persisted.versionId,
    config,
    source,
  });
}

export function requestRollback(
  storeId: string,
  currentVersionId: string,
  targetVersionId: string,
): Promise<StoreDraftMutation> {
  return requestVersion("/api/store/rollback", {
    storeId,
    currentVersionId,
    targetVersionId,
  });
}

async function requestVersion(
  url: string,
  body: Record<string, unknown>,
): Promise<StoreDraftMutation> {
  const attempt = versionMutationAttempt(url, body);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": attempt.key,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    if (isTerminalVersionFailure(response.status)) {
      versionMutationKeys.delete(attempt.fingerprint);
    }
    throw new Error("Version request failed");
  }
  const result = storeDraftMutationSchema.parse(
    (await response.json()) as unknown,
  );
  versionMutationKeys.delete(attempt.fingerprint);
  return result;
}

export async function requestPublish(storeId: string, versionId: string) {
  const response = await fetch("/api/store/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storeId, versionId }),
  });
  if (!response.ok) throw new Error("Publish failed");
}

export async function fetchProposal(
  config: StoreConfig,
  instruction: string,
  storeId?: string,
): Promise<StoreEditProposal> {
  const body = { config, instruction, storeId };
  const attempt = proposalAttempt(body);
  const response = await fetch("/api/store/propose", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": attempt.key,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    if (isTerminalRequestFailure(response.status)) {
      proposalKeys.delete(attempt.fingerprint);
    }
    throw new Error("Proposal failed");
  }
  const value: unknown = await response.json();
  const proposal = z
    .object({ proposal: storeEditProposalSchema })
    .parse(value).proposal;
  proposalKeys.delete(attempt.fingerprint);
  return proposal;
}

function proposalAttempt(body: Record<string, unknown>) {
  const fingerprint = JSON.stringify(body);
  const existing = proposalKeys.get(fingerprint);
  if (existing) return { fingerprint, key: existing };
  if (proposalKeys.size >= 50) {
    proposalKeys.delete(proposalKeys.keys().next().value as string);
  }
  const key = crypto.randomUUID();
  proposalKeys.set(fingerprint, key);
  return { fingerprint, key };
}

function versionMutationAttempt(url: string, body: Record<string, unknown>) {
  const fingerprint = JSON.stringify({ url, body });
  const existing = versionMutationKeys.get(fingerprint);
  if (existing) return { fingerprint, key: existing };
  trimAttemptCache(versionMutationKeys);
  const key = crypto.randomUUID();
  versionMutationKeys.set(fingerprint, key);
  return { fingerprint, key };
}

function trimAttemptCache(cache: Map<string, string>) {
  if (cache.size < 50) return;
  cache.delete(cache.keys().next().value as string);
}

function isTerminalRequestFailure(status: number) {
  return [400, 401, 403, 404, 422].includes(status);
}

function isTerminalVersionFailure(status: number) {
  return status >= 400 && status < 500;
}

const localDraftSchema = z
  .object({
    config: storeConfigSchema,
    product: productInputSchema,
    generatedAt: z.string().datetime(),
    persisted: generationResponseSchema.shape.persisted.optional(),
  })
  .strict();

let cachedDraft: DraftRecord | null = null;
let cachedSerializedDraft: string | null | undefined;

export function readStoredDraft(): DraftRecord | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("evolv:draft");
  if (stored === cachedSerializedDraft) return cachedDraft;
  cachedSerializedDraft = stored;
  if (!stored) {
    cachedDraft = null;
    return cachedDraft;
  }
  try {
    const value: unknown = JSON.parse(stored);
    cachedDraft = localDraftSchema.parse(value);
    return cachedDraft;
  } catch {
    localStorage.removeItem("evolv:draft");
    cachedDraft = null;
    cachedSerializedDraft = null;
    return cachedDraft;
  }
}

export function storeDraft(draft: DraftRecord) {
  if (draft.persisted) {
    localStorage.removeItem("evolv:draft");
    cachedDraft = null;
    cachedSerializedDraft = null;
    return;
  }
  cachedDraft = draft;
  cachedSerializedDraft = JSON.stringify(draft);
  localStorage.setItem("evolv:draft", cachedSerializedDraft);
}
