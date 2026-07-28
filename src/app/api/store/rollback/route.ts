import { NextResponse } from "next/server";
import { z } from "zod";

import { storeDraftMutationSchema } from "@/lib/domain/store-workspace";
import {
  failedMutation,
  invalidMutationRequest,
  unauthenticatedMutation,
  unavailableMutation,
  versionMutationRpcResponseSchema,
} from "@/lib/stores/version-mutation-response";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const failureMessage = "Rollback could not be prepared.";
const inputSchema = z
  .object({
    storeId: z.string().uuid(),
    currentVersionId: z.string().uuid(),
    targetVersionId: z.string().uuid(),
  })
  .strict();

export async function POST(request: Request) {
  const parsed = await readRequest(request);
  if (!parsed) return invalidMutationRequest(failureMessage);
  try {
    return await createRollback(parsed);
  } catch {
    return unavailableMutation(failureMessage);
  }
}

async function readRequest(request: Request) {
  try {
    const input = inputSchema.parse(await request.json());
    const mutationKey = z
      .string()
      .uuid()
      .parse(request.headers.get("Idempotency-Key"));
    return { input, mutationKey };
  } catch {
    return null;
  }
}

async function createRollback(
  parsed: NonNullable<Awaited<ReturnType<typeof readRequest>>>,
) {
  const authClient = await createClient();
  const { data: auth, error: authError } = await authClient.auth.getUser();
  if (!auth.user) {
    return unauthenticatedMutation(authError, failureMessage);
  }
  const rpcResult: unknown = await createAdminClient().rpc(
    "create_rollback_draft",
    {
      target_user_id: auth.user.id,
      target_store_id: parsed.input.storeId,
      expected_current_version_id: parsed.input.currentVersionId,
      target_mutation_key: parsed.mutationKey,
      target_version_id: parsed.input.targetVersionId,
    },
  );
  const result = versionMutationRpcResponseSchema.parse(rpcResult);
  if (result.error) {
    return failedMutation(result.error, "rollback", failureMessage);
  }
  return NextResponse.json(storeDraftMutationSchema.parse(result.data), {
    status: 201,
  });
}
