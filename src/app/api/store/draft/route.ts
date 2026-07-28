import { NextResponse } from "next/server";
import { z } from "zod";

import { storeConfigSchema } from "@/lib/domain/store-config";
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

const failureMessage = "Draft could not be saved.";
const requestSchema = z
  .object({
    storeId: z.string().uuid(),
    parentVersionId: z.string().uuid(),
    config: storeConfigSchema,
    source: z.enum(["manual_edit", "ai_edit"]).default("manual_edit"),
  })
  .strict();

export async function POST(request: Request) {
  const parsed = await readRequest(request);
  if (!parsed) return invalidMutationRequest(failureMessage);
  try {
    return await saveDraft(parsed);
  } catch {
    return unavailableMutation(failureMessage);
  }
}

async function readRequest(request: Request) {
  try {
    const input = requestSchema.parse(await request.json());
    const mutationKey = z
      .string()
      .uuid()
      .parse(request.headers.get("Idempotency-Key"));
    return { input, mutationKey };
  } catch {
    return null;
  }
}

async function saveDraft(
  parsed: NonNullable<Awaited<ReturnType<typeof readRequest>>>,
) {
  const authClient = await createClient();
  const { data: auth, error: authError } = await authClient.auth.getUser();
  if (!auth.user) {
    return unauthenticatedMutation(authError, failureMessage);
  }
  const rpcResponse: unknown = await createAdminClient().rpc(
    "create_store_draft",
    {
      target_user_id: auth.user.id,
      target_store_id: parsed.input.storeId,
      target_parent_version_id: parsed.input.parentVersionId,
      target_mutation_key: parsed.mutationKey,
      store_config: parsed.input.config,
      version_source: parsed.input.source,
    },
  );
  const result = versionMutationRpcResponseSchema.parse(rpcResponse);
  if (result.error) {
    return failedMutation(result.error, "draft", failureMessage);
  }
  return NextResponse.json(storeDraftMutationSchema.parse(result.data), {
    status: 201,
  });
}
