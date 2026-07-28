import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }
  try {
    const client = await createClient();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  } catch {
    return NextResponse.redirect(
      new URL("/login?error=signout_failed", request.url),
      303,
    );
  }
  return NextResponse.redirect(new URL("/", request.url), 303);
}
