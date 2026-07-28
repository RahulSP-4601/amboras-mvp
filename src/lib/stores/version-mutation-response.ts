import { NextResponse } from "next/server";
import { z } from "zod";

export const versionMutationRpcResponseSchema = z.object({
  data: z.unknown(),
  error: z.unknown().nullable(),
});

type MutationOperation = "draft" | "publish" | "rollback";

interface MutationFailure {
  code: string;
  status: number;
}

const errorSchema = z.object({ message: z.string() }).loose();
const statusByCode: Record<string, number> = {
  invalid_version_source: 422,
  invalid_draft: 422,
  invalid_published_version: 409,
  mutation_key_conflict: 409,
  product_config_mismatch: 422,
  rollback_target_missing: 404,
  stale_current_version: 409,
  stale_draft_version: 409,
  stale_parent_version: 409,
  store_not_owned: 403,
};
const operationCodes: Record<MutationOperation, string[]> = {
  draft: [
    "store_not_owned",
    "mutation_key_conflict",
    "stale_parent_version",
    "invalid_version_source",
    "product_config_mismatch",
  ],
  publish: [
    "store_not_owned",
    "stale_draft_version",
    "invalid_draft",
    "invalid_published_version",
  ],
  rollback: [
    "store_not_owned",
    "mutation_key_conflict",
    "stale_current_version",
    "rollback_target_missing",
  ],
};

export function invalidMutationRequest(message: string) {
  return mutationErrorResponse(message, {
    code: "invalid_request",
    status: 400,
  });
}

export function unavailableMutation(message: string) {
  return mutationErrorResponse(message, serviceUnavailable());
}

export function unauthenticatedMutation(
  error: { status?: number } | null,
  message: string,
) {
  if (error && (!error.status || error.status >= 500)) {
    return unavailableMutation(message);
  }
  return mutationErrorResponse("Unauthorized", {
    code: "unauthorized",
    status: 401,
  });
}

export function failedMutation(
  error: unknown,
  operation: MutationOperation,
  message: string,
) {
  return mutationErrorResponse(
    message,
    classifyMutationFailure(error, operation),
  );
}

function classifyMutationFailure(
  error: unknown,
  operation: MutationOperation,
): MutationFailure {
  const parsed = errorSchema.safeParse(error);
  if (!parsed.success) return serviceUnavailable();
  const code = operationCodes[operation].find((candidate) =>
    parsed.data.message.includes(candidate),
  );
  if (!code) return serviceUnavailable();
  return { code, status: statusByCode[code] ?? 503 };
}

function serviceUnavailable(): MutationFailure {
  return { code: "service_unavailable", status: 503 };
}

function mutationErrorResponse(message: string, failure: MutationFailure) {
  return NextResponse.json(
    { code: failure.code, error: message },
    { status: failure.status },
  );
}
