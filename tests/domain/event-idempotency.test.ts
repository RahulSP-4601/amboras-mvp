import { describe, expect, it } from "vitest";

import { isMatchingEventReplay } from "@/lib/domain/event-idempotency";

const original = {
  storeId: "store-a",
  visitorId: "visitor-a",
  sessionId: "session-a",
  eventType: "page_view",
  metadata: { source: "public", depth: 50 },
  synthetic: false,
};

describe("event replay identity", () => {
  it("accepts the same context regardless of metadata key order", () => {
    expect(
      isMatchingEventReplay(original, {
        ...original,
        metadata: { depth: 50, source: "public" },
      }),
    ).toBe(true);
  });

  it("rejects an event ID reused for another store", () => {
    expect(
      isMatchingEventReplay(original, { ...original, storeId: "store-b" }),
    ).toBe(false);
  });

  it("rejects an event ID reused for another event payload", () => {
    expect(
      isMatchingEventReplay(original, {
        ...original,
        eventType: "conversion_completed",
      }),
    ).toBe(false);
  });
});
