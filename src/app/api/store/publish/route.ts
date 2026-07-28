import { NextResponse } from "next/server";
import { z } from "zod";

import {
  failedMutation,
  invalidMutationRequest,
  unauthenticatedMutation,
  unavailableMutation,
  versionMutationRpcResponseSchema,
} from "@/lib/stores/version-mutation-response";
import { createClient } from "@/lib/supabase/server";

const failureMessage = "Draft could not be published.";
const requestSchema = z
  .object({
    storeId: z.string().uuid(),
    versionId: z.string().uuid(),
  })
  .strict();

export async function POST(request: Request) {
  const input = await readRequest(request);
  if (!input) return invalidMutationRequest(failureMessage);
  try {
    return await publishVersion(input);
  } catch {
    return unavailableMutation(failureMessage);
  }
}

async function readRequest(request: Request) {
  try {
    return requestSchema.parse(await request.json());
  } catch {
    return null;
  }
}

async function publishVersion(input: z.infer<typeof requestSchema>) {
  const client = await createClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (!auth.user) {
    return unauthenticatedMutation(authError, failureMessage);
  }
  const rpcResponse: unknown = await client.rpc("publish_store_version", {
    target_store_id: input.storeId,
    target_version_id: input.versionId,
  });
  const result = versionMutationRpcResponseSchema.parse(rpcResponse);
  if (result.error) {
    return failedMutation(result.error, "publish", failureMessage);
  }
  return NextResponse.json({ published: true });
}
