import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  eventRequestSchema,
  ingestEvent,
  type TrackedEvent,
} from "@/lib/domain/events";

function event(): TrackedEvent {
  return {
    eventId: randomUUID(),
    storeId: randomUUID(),
    visitorId: randomUUID(),
    sessionId: randomUUID(),
    eventType: "conversion_completed",
    createdAt: new Date().toISOString(),
    synthetic: false,
  };
}

describe("event ingestion contract", () => {
  it("accepts only known events", () => {
    expect(
      eventRequestSchema.safeParse({
        eventId: randomUUID(),
        eventType: "purchase",
      }).success,
    ).toBe(false);
  });

  it("is idempotent by event ID", () => {
    const candidate = event();
    const once = ingestEvent([], candidate);
    const twice = ingestEvent(once, candidate);

    expect(twice).toHaveLength(1);
  });

  it("rejects oversized metadata", () => {
    const result = eventRequestSchema.safeParse({
      eventId: randomUUID(),
      eventType: "page_view",
      metadata: { oversized: "x".repeat(2_100) },
    });

    expect(result.success).toBe(false);
  });
});
