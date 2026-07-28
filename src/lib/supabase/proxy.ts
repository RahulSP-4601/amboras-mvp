import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/env";
import { addPublicStoreIdentity } from "@/lib/events/identity";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const publicSlug = readPublicStoreSlug(request);
  if (publicSlug) {
    return addPublicStoreIdentity(request, response, publicSlug);
  }
  if (!isSupabaseConfigured()) {
    return request.nextUrl.pathname.startsWith("/app") &&
      process.env.NODE_ENV === "production"
      ? NextResponse.redirect(
          new URL("/login?error=not_configured", request.url),
        )
      : response;
  }

  const client = createProxyClient(
    request,
    () => response,
    (next) => {
      response = next;
    },
  );
  const { data, error } = await client.auth.getUser();
  const isProtected = request.nextUrl.pathname.startsWith("/app");
  if (isProtected && error) {
    return NextResponse.json(
      { error: "Authentication is temporarily unavailable." },
      { status: 503 },
    );
  }
  if (isProtected && !data.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return response;
}

function readPublicStoreSlug(request: NextRequest): string | null {
  if (!request.nextUrl.pathname.startsWith("/s/")) return null;
  return request.nextUrl.pathname.split("/")[2] || null;
}

function createProxyClient(
  request: NextRequest,
  getResponse: () => NextResponse,
  setResponse: (response: NextResponse) => void,
) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          const next = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            next.cookies.set(name, value, options);
          });
          setResponse(next);
          getResponse();
        },
      },
    },
  );
}
