import { describe, expect, it } from "vitest";

import { generationFailureIsTerminal } from "@/lib/domain/generation-retry";

describe("generation failure ownership", () => {
  it("retains uploads for active or ambiguous generation failures", () => {
    expect(generationFailureIsTerminal(409, "in_progress")).toBe(false);
    expect(generationFailureIsTerminal(503, undefined)).toBe(false);
    expect(generationFailureIsTerminal(504, undefined)).toBe(false);
  });

  it("releases uploads and keys after terminal generation failures", () => {
    expect(generationFailureIsTerminal(422, "attempts_exhausted")).toBe(true);
    expect(generationFailureIsTerminal(409, "key_conflict")).toBe(true);
    expect(generationFailureIsTerminal(409, "store_exists")).toBe(true);
  });
});
