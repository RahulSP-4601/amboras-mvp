import { describe, expect, it } from "vitest";

import { resolveProductName } from "@/lib/domain/product";

describe("canonical product names", () => {
  it("preserves a confirmed product name", () => {
    expect(
      resolveProductName({
        description:
          "A durable notebook for focused daily writing and planning.",
        name: "Focus Book",
        brandName: "Quiet Studio",
      }),
    ).toBe("Focus Book");
  });

  it("infers a product name without substituting the brand", () => {
    expect(
      resolveProductName({
        description:
          "a durable notebook for focused daily writing and planning",
        brandName: "Quiet Studio",
      }),
    ).toBe("A Durable Notebook");
  });

  it("preserves non-Latin product descriptions", () => {
    expect(
      resolveProductName({
        description: "毎日の仕事に使える丈夫で軽量なノートブックです",
      }),
    ).toBe("毎日の仕事に使える丈夫で軽量なノートブックです");
  });

  it("bounds inferred names to the canonical database limit", () => {
    const name = resolveProductName({
      description: `${"a".repeat(200)} is a valid detailed product description`,
    });

    expect(Array.from(name)).toHaveLength(120);
  });
});
