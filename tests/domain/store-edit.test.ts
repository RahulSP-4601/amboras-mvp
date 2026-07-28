import { describe, expect, it } from "vitest";

import { createDeterministicDraft } from "@/lib/domain/generation";
import {
  applyStoreEditProposal,
  storeEditProposalSchema,
} from "@/lib/domain/store-edit";

const config = createDeterministicDraft({
  description: "A durable notebook designed for calm and focused daily work.",
  name: "Focus Book",
});

describe("controlled store edits", () => {
  it("changes only an allowed field without mutating the source", () => {
    const proposal = storeEditProposalSchema.parse({
      summary: "Clarify the headline",
      rationale: "Make the product focus easier to understand.",
      changes: [
        { field: "heroHeadline", value: "Focus for every working day." },
      ],
    });
    const next = applyStoreEditProposal(config, proposal);

    expect(next.heroHeadline).toBe("Focus for every working day.");
    expect(config.heroHeadline).not.toBe(next.heroHeadline);
    expect(next.ctaText).toBe(config.ctaText);
  });

  it("rejects duplicate and unapproved patch fields", () => {
    const duplicate = {
      summary: "Change twice",
      rationale: "Invalid duplicate fields.",
      changes: [
        { field: "ctaText", value: "Explore" },
        { field: "ctaText", value: "Discover" },
      ],
    };
    const executable = {
      summary: "Unsafe",
      rationale: "This must not be accepted.",
      changes: [{ field: "component", value: "<script />" }],
    };

    expect(storeEditProposalSchema.safeParse(duplicate).success).toBe(false);
    expect(storeEditProposalSchema.safeParse(executable).success).toBe(false);
  });
});
