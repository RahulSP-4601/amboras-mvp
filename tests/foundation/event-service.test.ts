import { beforeEach, describe, expect, it, vi } from "vitest";

const eventMocks = vi.hoisted(() => {
  const select = vi.fn();
  const eq = vi.fn();
  const maybeSingle = vi.fn();
  const query = { eq, maybeSingle, select };
  select.mockReturnValue(query);
  eq.mockReturnValue(query);
  return { from: vi.fn().mockReturnValue(query), maybeSingle };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: eventMocks.from }),
}));

import {
  EventServiceError,
  recordPublicEvent,
} from "@/lib/events/event-service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("public event store lookup", () => {
  it("reports a database failure as unavailable", async () => {
    eventMocks.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "database unavailable" },
    });

    await expect(recordPublicEvent(event(), context())).rejects.toMatchObject({
      code: "unavailable",
    } satisfies Partial<EventServiceError>);
  });

  it("reports a successful empty lookup as not found", async () => {
    eventMocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(recordPublicEvent(event(), context())).rejects.toMatchObject({
      code: "not_found",
    } satisfies Partial<EventServiceError>);
  });
});

function event() {
  return {
    eventId: "16de9df4-b15f-45ae-9917-412f72c4ea51",
    eventType: "page_view",
  };
}

function context() {
  return {
    slug: "focus-book",
    visitorId: "50000000-0000-4000-8000-000000000001",
    sessionId: "60000000-0000-4000-8000-000000000001",
    synthetic: false,
    abuseKey: "test-address",
  };
}
