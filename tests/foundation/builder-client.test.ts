import { afterEach, describe, expect, it, vi } from "vitest";

import { createDeterministicDraft } from "@/lib/domain/generation";
import type { DraftRecord } from "@/lib/domain/store-workspace";
import { requestDraft } from "@/lib/stores/builder-client";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("builder version retries", () => {
  it("uses a new idempotency key after a definitive conflict", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ code: "stale_parent_version" }), {
        status: 409,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const draft = persistedDraft();

    await expect(
      requestDraft(draft, draft.config, "manual_edit"),
    ).rejects.toThrow("Version request failed");
    await expect(
      requestDraft(draft, draft.config, "manual_edit"),
    ).rejects.toThrow("Version request failed");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestKey(fetchMock.mock.calls[0])).not.toBe(
      requestKey(fetchMock.mock.calls[1]),
    );
  });
});

function persistedDraft(): DraftRecord {
  const product = {
    description: "A durable notebook designed for calm and focused daily work.",
  };
  return {
    config: createDeterministicDraft(product),
    generatedAt: new Date().toISOString(),
    persisted: {
      slug: "calm-notebook",
      storeId: "2b8ed650-6db4-4fcc-b54d-4f7556e0625d",
      versionId: "f2ac8cb2-32b7-4a8a-a99c-567bc342aca8",
    },
    product,
  };
}

function requestKey(call: Parameters<typeof fetch> | undefined) {
  return new Headers(call?.[1]?.headers).get("Idempotency-Key");
}
