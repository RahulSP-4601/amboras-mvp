import { afterEach, describe, expect, it, vi } from "vitest";

const generationMocks = vi.hoisted(() => {
  class GenerationAuthenticationError extends Error {}
  class GenerationClaimError extends Error {
    readonly code = "in_progress";
  }
  class AiRequestLimitError extends Error {}
  return {
    AiRequestLimitError,
    GenerationAuthenticationError,
    GenerationClaimError,
    claim: vi.fn(),
    getStage: vi.fn(),
    isConfigured: vi.fn(() => true),
  };
});

vi.mock("@/lib/ai/generation-jobs", () => ({
  GenerationAuthenticationError: generationMocks.GenerationAuthenticationError,
  GenerationClaimError: generationMocks.GenerationClaimError,
  claimGenerationJob: generationMocks.claim,
  failGenerationJob: vi.fn(),
  getGenerationJobStage: generationMocks.getStage,
  saveGenerationOutput: vi.fn(),
  updateGenerationStage: vi.fn(),
}));

vi.mock("@/lib/ai/request-guard", () => ({
  AiRequestLimitError: generationMocks.AiRequestLimitError,
}));

vi.mock("@/lib/ai/store-generator", () => ({
  generateStore: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  isSupabaseConfigured: generationMocks.isConfigured,
}));

vi.mock("@/lib/stores/persist-generated-store", () => ({
  persistGeneratedStore: vi.fn(),
}));

import { GET, POST } from "@/app/api/store/generate/route";

afterEach(() => {
  vi.clearAllMocks();
  generationMocks.isConfigured.mockReturnValue(true);
  vi.unstubAllEnvs();
});

describe("generation authentication responses", () => {
  it("returns 401 when generation has no authenticated user", async () => {
    generationMocks.claim.mockRejectedValue(
      new generationMocks.GenerationAuthenticationError(),
    );

    const response = await POST(generationRequest());

    expect(response.status).toBe(401);
  });

  it("does not misreport a status backend failure as unauthorized", async () => {
    generationMocks.getStage.mockRejectedValue(
      new Error("database unavailable"),
    );
    const request = new Request(
      "https://evolv.example/api/store/generate?key=34ff2174-a59d-43e1-9726-8824b4320e76",
    );

    const response = await GET(request);

    expect(response.status).toBe(503);
  });

  it("fails closed in production when persistence is not configured", async () => {
    generationMocks.isConfigured.mockReturnValue(false);
    vi.stubEnv("NODE_ENV", "production");

    const response = await POST(generationRequest());

    expect(response.status).toBe(503);
    expect(generationMocks.claim).not.toHaveBeenCalled();
  });
});

function generationRequest() {
  return new Request("https://evolv.example/api/store/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": "34ff2174-a59d-43e1-9726-8824b4320e76",
    },
    body: JSON.stringify({
      description:
        "A durable notebook designed for calm and focused daily work.",
    }),
  });
}
