import "server-only";

import { createHmac } from "node:crypto";

import type { NextRequest } from "next/server";

import { getAdminEnv } from "@/lib/env";

export function deriveAbuseKey(request: NextRequest): string {
  const address = readForwardedAddress(request);
  const secret = getAdminEnv().SUPABASE_SERVICE_ROLE_KEY;
  return createHmac("sha256", secret).update(address).digest("hex");
}

function readForwardedAddress(request: NextRequest): string {
  const trusted =
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    "unavailable";
  return trusted.split(",")[0]?.trim().slice(0, 128) || "unavailable";
}
