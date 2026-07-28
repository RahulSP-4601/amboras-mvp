import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { deriveAbuseKey } from "@/lib/events/event-abuse";
import {
  EventServiceError,
  recordPublicEvent,
} from "@/lib/events/event-service";
import {
  resolveEventIdentity,
  setEventIdentityCookies,
} from "@/lib/events/identity";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const identity = resolveEventIdentity(request, slug);
  try {
    const payload: unknown = await request.json();
    const result = await recordPublicEvent(payload, {
      slug,
      visitorId: identity.visitorId,
      sessionId: identity.sessionId,
      synthetic: false,
      abuseKey: deriveAbuseKey(request),
    });
    const response = NextResponse.json(result, {
      status: result.duplicate ? 200 : 201,
    });
    setEventIdentityCookies(response, slug, identity);
    return response;
  } catch (error) {
    const status = eventErrorStatus(error);
    return NextResponse.json({ error: "Event was rejected." }, { status });
  }
}

function eventErrorStatus(error: unknown): number {
  if (error instanceof ZodError) return 400;
  if (!(error instanceof EventServiceError)) return 503;
  if (error.code === "not_found") return 404;
  if (error.code === "rate_limited") return 429;
  if (error.code === "invalid_session" || error.code === "conflict") return 409;
  return 503;
}
