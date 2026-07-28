import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createDeterministicDraft } from "@/lib/domain/generation";
import {
  createRollbackVersion,
  publishVersion,
  type StoreVersion,
} from "@/lib/domain/versions";

function version(status: StoreVersion["status"], number: number): StoreVersion {
  return {
    id: randomUUID(),
    storeId: "aa8dd370-8734-40bc-badd-ad7bfa5a8dfc",
    versionNumber: number,
    config: createDeterministicDraft({
      description:
        "A durable premium notebook designed for focused daily work.",
      name: "Focus Book",
    }),
    status,
    source: "manual_edit",
    parentVersionId: null,
    createdAt: new Date(number * 1_000).toISOString(),
  };
}

describe("immutable store versions", () => {
  it("publishes a draft and archives the previous version", () => {
    const published = version("published", 1);
    const draft = version("draft", 2);
    const result = publishVersion([published, draft], draft.id);

    expect(result.find((item) => item.id === published.id)?.status).toBe(
      "archived",
    );
    expect(result.find((item) => item.id === draft.id)?.status).toBe(
      "published",
    );
    expect(published.status).toBe("published");
  });

  it("creates rollback as a new draft without mutating history", () => {
    const old = version("archived", 1);
    const current = version("published", 2);
    const rollback = createRollbackVersion(
      [old, current],
      old.id,
      randomUUID(),
      new Date().toISOString(),
    );

    expect(rollback.versionNumber).toBe(3);
    expect(rollback.parentVersionId).toBe(old.id);
    expect(rollback.status).toBe("draft");
    expect(old.status).toBe("archived");
  });
});
