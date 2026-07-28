import { createHash, randomUUID } from "node:crypto";

import { type NextRequest, NextResponse } from "next/server";

const VISITOR_COOKIE = "evolv_visitor";
const SESSION_WINDOW_SECONDS = 30 * 60;

export interface EventIdentity {
  visitorId: string;
  sessionId: string;
}

export function resolveEventIdentity(
  request: NextRequest,
  slug: string,
  now = Date.now(),
): EventIdentity {
  const names = eventSessionCookieNames(slug);
  const visitorId =
    validUuid(request.cookies.get(VISITOR_COOKIE)?.value) || randomUUID();
  const seen = Number(request.cookies.get(names.seen)?.value || 0);
  const expired = !seen || now - seen > SESSION_WINDOW_SECONDS * 1_000;
  const savedSession = validUuid(request.cookies.get(names.session)?.value);
  return {
    visitorId,
    sessionId: expired || !savedSession ? randomUUID() : savedSession,
  };
}

export function setEventIdentityCookies(
  response: NextResponse,
  slug: string,
  identity: EventIdentity,
  now = Date.now(),
) {
  const names = eventSessionCookieNames(slug);
  const shared = cookieOptions();
  response.cookies.set(VISITOR_COOKIE, identity.visitorId, {
    ...shared,
    maxAge: 60 * 60 * 24 * 365,
  });
  response.cookies.set(names.session, identity.sessionId, {
    ...shared,
    maxAge: SESSION_WINDOW_SECONDS,
  });
  response.cookies.set(names.seen, String(now), {
    ...shared,
    maxAge: SESSION_WINDOW_SECONDS,
  });
}

export function addPublicStoreIdentity(
  request: NextRequest,
  response: NextResponse,
  slug: string,
): NextResponse {
  const identity = resolveEventIdentity(request, slug);
  setEventIdentityCookies(response, slug, identity);
  return response;
}

export function eventSessionCookieNames(slug: string) {
  const key = createHash("sha256").update(slug).digest("hex").slice(0, 16);
  return {
    session: `evolv_session_${key}`,
    seen: `evolv_session_seen_${key}`,
  };
}

function validUuid(value: string | undefined): string | null {
  return value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value
    : null;
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}
