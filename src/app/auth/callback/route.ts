import { NextResponse } from "next/server";

import { safeNextPath } from "@/lib/auth/safe-next-path";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"), url);

  if (!code)
    return NextResponse.redirect(new URL("/login?error=missing_code", url));

  try {
    const client = await createClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return NextResponse.redirect(new URL(next, url));
  } catch {
    return NextResponse.redirect(new URL("/login?error=callback_failed", url));
  }
}
