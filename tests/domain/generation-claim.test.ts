import { describe, expect, it } from "vitest";

import { generationJobDisposition } from "@/lib/domain/generation-claim";

const now = Date.parse("2026-07-28T12:00:00.000Z");

describe("generation idempotency decisions", () => {
  it("replays a completed job instead of generating again", () => {
    expect(
      generationJobDisposition(
        { status: "succeeded", attemptCount: 1, startedAt: null },
        now,
      ),
    ).toBe("replay");
  });

  it("allows a failed job to retry within the attempt limit", () => {
    expect(
      generationJobDisposition(
        { status: "failed", attemptCount: 1, startedAt: null },
        now,
      ),
    ).toBe("restart");
  });

  it("reclaims stale work but waits for a live request", () => {
    const stale = new Date(now - 180_000).toISOString();
    const active = new Date(now - 30_000).toISOString();
    expect(
      generationJobDisposition(
        { status: "running", attemptCount: 1, startedAt: stale },
        now,
      ),
    ).toBe("restart");
    expect(
      generationJobDisposition(
        { status: "running", attemptCount: 1, startedAt: active },
        now,
      ),
    ).toBe("wait");
  });

  it("stops after the bounded attempt count", () => {
    expect(
      generationJobDisposition(
        { status: "failed", attemptCount: 3, startedAt: null },
        now,
      ),
    ).toBe("exhausted");
  });
});

describe("generation final-attempt leases", () => {
  it("waits for a live final attempt before expiring its lease", () => {
    const active = new Date(now - 30_000).toISOString();
    const stale = new Date(now - 180_000).toISOString();

    expect(
      generationJobDisposition(
        { status: "running", attemptCount: 3, startedAt: active },
        now,
      ),
    ).toBe("wait");
    expect(
      generationJobDisposition(
        { status: "running", attemptCount: 3, startedAt: stale },
        now,
      ),
    ).toBe("exhausted");
  });
});
