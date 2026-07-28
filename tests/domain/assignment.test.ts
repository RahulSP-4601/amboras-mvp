import { describe, expect, it } from "vitest";

import { assignVariant } from "@/lib/domain/assignment";

describe("stable visitor assignment", () => {
  it("keeps the same visitor in the same variant", () => {
    const values = Array.from({ length: 10 }, () =>
      assignVariant(
        "a-secure-test-secret-that-is-long",
        "experiment-1",
        "visitor-1",
      ),
    );

    expect(new Set(values).size).toBe(1);
  });

  it("produces an approximately even deterministic distribution", () => {
    const variants = Array.from({ length: 10_000 }, (_, index) =>
      assignVariant(
        "a-secure-test-secret-that-is-long",
        "experiment-1",
        `visitor-${index}`,
      ),
    );
    const controls = variants.filter((variant) => variant === "A").length;

    expect(controls).toBeGreaterThan(4_800);
    expect(controls).toBeLessThan(5_200);
  });

  it("rejects invalid allocation", () => {
    expect(() =>
      assignVariant("secret", "experiment", "visitor", 10_001),
    ).toThrow();
  });
});
