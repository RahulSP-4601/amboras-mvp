import { describe, expect, it } from "vitest";

import { createDeterministicDraft } from "@/lib/domain/generation";
import { storeConfigSchema } from "@/lib/domain/store-config";

const input = {
  description:
    "A premium lightweight backpack for commuters who need durable materials and calm organization.",
  name: "Field Pack",
  price: 249,
};

describe("StoreConfig generation contract", () => {
  it("creates a valid dynamic configuration", () => {
    const config = createDeterministicDraft(input);

    expect(storeConfigSchema.parse(config)).toEqual(config);
    expect(config.heroHeadline).toContain("Field Pack");
    expect(JSON.stringify(config)).not.toMatch(/jsx|javascript|<script/i);
  });

  it("bounds copy derived from a maximum-length product name", () => {
    const config = createDeterministicDraft({
      ...input,
      name: "x".repeat(120),
    });

    expect(storeConfigSchema.parse(config)).toEqual(config);
    expect(config.brandName.length).toBeLessThanOrEqual(120);
    expect(config.tagline.length).toBeLessThanOrEqual(120);
    expect(config.heroHeadline.length).toBeLessThanOrEqual(120);
    expect(config.faq[0]?.question.length).toBeLessThanOrEqual(120);
  });

  it("rejects unknown executable fields", () => {
    const config = {
      ...createDeterministicDraft(input),
      component: "<script />",
    };

    expect(storeConfigSchema.safeParse(config).success).toBe(false);
  });

  it("rejects duplicate and missing section ordering", () => {
    const config = createDeterministicDraft(input);
    config.sectionOrder = ["header", "hero", "hero", "footer"];

    expect(storeConfigSchema.safeParse(config).success).toBe(false);
  });

  it("does not count duplicate enabled sections toward the minimum", () => {
    const config = createDeterministicDraft(input);
    config.enabledSections = ["header", "hero", "hero", "footer"];

    expect(storeConfigSchema.safeParse(config).success).toBe(false);
  });
});
