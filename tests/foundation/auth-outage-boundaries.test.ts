import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  claimProposal: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: authMocks.getUser },
  })),
}));

vi.mock("@/lib/env", () => ({
  isSupabaseConfigured: () => true,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({ auth: { getUser: authMocks.getUser } }),
  ),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => {
    throw new Error("Admin client must not be used during an auth outage");
  }),
}));

vi.mock("@/lib/ai/proposal-jobs", () => ({
  ProposalJobError: class ProposalJobError extends Error {},
  claimProposalJob: authMocks.claimProposal,
  completeProposalJob: vi.fn(),
  failProposalJob: vi.fn(),
}));

vi.mock("@/lib/ai/store-editor", () => ({
  proposeStoreEdit: vi.fn(),
}));

vi.mock("@/lib/ai/request-guard", () => ({
  AiRequestLimitError: class AiRequestLimitError extends Error {},
  enforceAiRequestLimit: vi.fn(),
}));

import { POST as proposeStoreEdit } from "@/app/api/store/propose/route";
import {
  claimGenerationJob,
  GenerationAuthenticationError,
  getGenerationJobStage,
} from "@/lib/ai/generation-jobs";
import { createDeterministicDraft } from "@/lib/domain/generation";
import { updateSession } from "@/lib/supabase/proxy";

const authOutage = {
  data: { user: null },
  error: { message: "authentication backend unavailable" },
};

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.getUser.mockResolvedValue(authOutage);
});

describe("authentication outage boundaries", () => {
  it("keeps generation authentication outages retryable", async () => {
    const claimError = await captureError(
      claimGenerationJob(
        "34ff2174-a59d-43e1-9726-8824b4320e76",
        "product input",
      ),
    );
    const stageError = await captureError(
      getGenerationJobStage("34ff2174-a59d-43e1-9726-8824b4320e76"),
    );

    expect(claimError).not.toBeInstanceOf(GenerationAuthenticationError);
    expect(stageError).not.toBeInstanceOf(GenerationAuthenticationError);
  });

  it("returns 503 before starting a proposal job", async () => {
    const response = await proposeStoreEdit(proposalRequest());

    expect(response.status).toBe(503);
    expect(authMocks.claimProposal).not.toHaveBeenCalled();
  });

  it("returns 503 instead of redirecting protected routes", async () => {
    const request = new NextRequest("https://evolv.example/app/store");

    const response = await updateSession(request);

    expect(response.status).toBe(503);
    expect(response.headers.get("location")).toBeNull();
  });
});

async function captureError(operation: Promise<unknown>) {
  try {
    await operation;
  } catch (error) {
    return error;
  }
  throw new Error("Expected operation to fail");
}

function proposalRequest() {
  return new Request("https://evolv.example/api/store/propose", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": "34ff2174-a59d-43e1-9726-8824b4320e76",
    },
    body: JSON.stringify({
      config: createDeterministicDraft({
        description: "A durable notebook for focused daily work.",
      }),
      instruction: "Improve the headline",
      storeId: "2b8ed650-6db4-4fcc-b54d-4f7556e0625d",
    }),
  });
}
