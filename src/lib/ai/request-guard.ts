import "server-only";

import { z } from "zod";

import { getAiRequestLimits } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;
type AiRequestType = "generation" | "proposal";

export class AiRequestLimitError extends Error {}

export async function enforceAiRequestLimit(
  client: AdminClient,
  userId: string,
  requestType: AiRequestType,
) {
  const bucket = new Date(
    Math.floor(Date.now() / 3_600_000) * 3_600_000,
  ).toISOString();
  const limits = getAiRequestLimits();
  const response: unknown = await client.rpc("consume_rate_limit", {
    limit_key: `ai:${requestType}:${userId}`,
    bucket,
    request_limit: limits[requestType],
  });
  const { data, error } = z
    .object({ data: z.boolean().nullable(), error: z.unknown().nullable() })
    .parse(response);
  if (error) throw new Error("AI request limit is unavailable");
  if (data !== true) {
    throw new AiRequestLimitError("AI request limit exceeded");
  }
}
