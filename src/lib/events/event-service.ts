import { z } from "zod";

import { eventRequestSchema } from "@/lib/domain/events";
import { isMatchingEventReplay } from "@/lib/domain/event-idempotency";
import { createAdminClient } from "@/lib/supabase/admin";

export interface EventContext {
  slug: string;
  visitorId: string;
  sessionId: string;
  synthetic: boolean;
  abuseKey: string;
}

export class EventServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_found"
      | "rate_limited"
      | "invalid_session"
      | "conflict"
      | "unavailable",
  ) {
    super(message);
  }
}

const publishedStoreSchema = z.object({ id: z.string().uuid() });
const rpcResponseSchema = z.object({
  error: z.object({ message: z.string() }).passthrough().nullable(),
});

export async function recordPublicEvent(
  payload: unknown,
  context: EventContext,
) {
  const event = eventRequestSchema.parse(payload);
  const client = createAdminClient();
  const storeResponse: unknown = await client
    .from("stores")
    .select("id")
    .eq("slug", context.slug)
    .eq("status", "published")
    .maybeSingle();
  const storeResult = z
    .object({ data: z.unknown().nullable(), error: z.unknown().nullable() })
    .parse(storeResponse);
  if (storeResult.error) {
    throw new EventServiceError(
      "Published store is unavailable",
      "unavailable",
    );
  }
  if (!storeResult.data) {
    throw new EventServiceError("Published store was not found", "not_found");
  }
  const store = publishedStoreSchema.parse(storeResult.data);

  await enforceRateLimit(client, context, store.id);
  await ensureVisitorAndSession(client, context, store.id);
  const { error } = await client.from("events").insert({
    id: event.eventId,
    store_id: store.id,
    visitor_id: context.visitorId,
    session_id: context.sessionId,
    event_type: event.eventType,
    metadata: event.metadata ?? {},
    synthetic: context.synthetic,
  });
  if (error?.code === "23505") {
    return resolveDuplicateEvent(client, event, context, store.id);
  }
  if (error)
    throw new EventServiceError("Event could not be stored", "unavailable");
  return { duplicate: false };
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function enforceRateLimit(
  client: AdminClient,
  context: EventContext,
  storeId: string,
) {
  const bucket = new Date(
    Math.floor(Date.now() / 60_000) * 60_000,
  ).toISOString();
  await consumeLimit(
    client,
    `event:${storeId}:address:${context.abuseKey}`,
    bucket,
    300,
  );
  await consumeLimit(
    client,
    `event:${storeId}:visitor:${context.visitorId}`,
    bucket,
    120,
  );
  await consumeLimit(client, `event:${storeId}:all`, bucket, 5_000);
}

async function consumeLimit(
  client: AdminClient,
  limitKey: string,
  bucket: string,
  requestLimit: number,
) {
  const response: unknown = await client.rpc("consume_rate_limit", {
    limit_key: limitKey,
    bucket,
    request_limit: requestLimit,
  });
  const { data, error } = z
    .object({ data: z.boolean().nullable(), error: z.unknown().nullable() })
    .parse(response);
  if (error)
    throw new EventServiceError("Rate limit is unavailable", "unavailable");
  if (data !== true)
    throw new EventServiceError("Event rate limit exceeded", "rate_limited");
}

async function ensureVisitorAndSession(
  client: AdminClient,
  context: EventContext,
  storeId: string,
) {
  const response: unknown = await client.rpc("prepare_event_identity", {
    target_session_id: context.sessionId,
    target_visitor_id: context.visitorId,
    target_store_id: storeId,
    target_synthetic: context.synthetic,
  });
  const { error } = rpcResponseSchema.parse(response);
  if (error?.message.includes("identity_mismatch")) {
    throw new EventServiceError("Session belongs elsewhere", "invalid_session");
  }
  if (error) {
    throw new EventServiceError("Session could not be prepared", "unavailable");
  }
}

const storedEventSchema = z.object({
  store_id: z.string().uuid(),
  visitor_id: z.string().uuid(),
  session_id: z.string().uuid(),
  event_type: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  synthetic: z.boolean(),
});

async function resolveDuplicateEvent(
  client: AdminClient,
  event: z.infer<typeof eventRequestSchema>,
  context: EventContext,
  storeId: string,
) {
  const { data, error } = await client
    .from("events")
    .select("store_id,visitor_id,session_id,event_type,metadata,synthetic")
    .eq("id", event.eventId)
    .maybeSingle();
  if (error || !data) {
    throw new EventServiceError(
      "Duplicate event could not be read",
      "unavailable",
    );
  }
  const stored = storedEventSchema.parse(data);
  if (!sameEventContext(stored, event, context, storeId)) {
    throw new EventServiceError(
      "Event identifier belongs elsewhere",
      "conflict",
    );
  }
  return { duplicate: true };
}

function sameEventContext(
  stored: z.infer<typeof storedEventSchema>,
  event: z.infer<typeof eventRequestSchema>,
  context: EventContext,
  storeId: string,
) {
  return isMatchingEventReplay(
    {
      storeId: stored.store_id,
      visitorId: stored.visitor_id,
      sessionId: stored.session_id,
      eventType: stored.event_type,
      metadata: stored.metadata,
      synthetic: stored.synthetic,
    },
    {
      storeId,
      visitorId: context.visitorId,
      sessionId: context.sessionId,
      eventType: event.eventType,
      metadata: event.metadata ?? {},
      synthetic: context.synthetic,
    },
  );
}
