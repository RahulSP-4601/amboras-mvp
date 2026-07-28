import { describe, expect, it } from "vitest";

import { safeNextPath } from "@/lib/auth/safe-next-path";

const applicationUrl = new URL("https://evolv.example/auth/callback");

describe("safe OAuth destination", () => {
  it("keeps same-origin application paths", () => {
    expect(safeNextPath("/app/store?view=mobile", applicationUrl)).toBe(
      "/app/store?view=mobile",
    );
  });

  it.each(["//evil.example", "/\\evil.example", "/%5Cevil.example"])(
    "rejects an external path form: %s",
    (path) => {
      expect(safeNextPath(decodeURIComponent(path), applicationUrl)).toBe(
        "/app",
      );
    },
  );

  it("rejects malformed and non-path destinations", () => {
    expect(safeNextPath("https://evil.example", applicationUrl)).toBe("/app");
    expect(safeNextPath(null, applicationUrl)).toBe("/app");
  });
});
