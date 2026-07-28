import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDeterministicDraft } from "@/lib/domain/generation";

const routeMocks = vi.hoisted(() => ({
  authenticatedRpc: vi.fn(),
  getUser: vi.fn(),
  adminRpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: routeMocks.getUser },
      rpc: routeMocks.authenticatedRpc,
    }),
  ),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: routeMocks.adminRpc }),
}));

import { POST as createDraft } from "@/app/api/store/draft/route";
import { POST as publishDraft } from "@/app/api/store/publish/route";
import { POST as createRollback } from "@/app/api/store/rollback/route";

const userId = "048c6691-5a11-4b32-b8e0-5c8ea31ce5df";
const storeId = "2b8ed650-6db4-4fcc-b54d-4f7556e0625d";
const versionId = "f2ac8cb2-32b7-4a8a-a99c-567bc342aca8";
const targetVersionId = "9c760beb-f285-4c31-98d5-d81b750c0b79";
const mutationKey = "34ff2174-a59d-43e1-9726-8824b4320e76";

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.getUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
});

describe("version mutation error responses", () => {
  it("returns a coded conflict for a stale draft parent", async () => {
    routeMocks.adminRpc.mockResolvedValue(rpcFailure("stale_parent_version"));

    const response = await createDraft(draftRequest());
    const body: unknown = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ code: "stale_parent_version" });
  });

  it("returns service unavailable for an unknown database failure", async () => {
    routeMocks.adminRpc.mockResolvedValue(rpcFailure("connection refused"));

    const response = await createDraft(draftRequest());
    const body: unknown = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ code: "service_unavailable" });
  });

  it("returns a coded conflict for a stale rollback base", async () => {
    routeMocks.adminRpc.mockResolvedValue(rpcFailure("stale_current_version"));

    const response = await createRollback(rollbackRequest());
    const body: unknown = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ code: "stale_current_version" });
  });

  it("treats an invalid RPC success payload as unavailable", async () => {
    routeMocks.adminRpc.mockResolvedValue({ data: {}, error: null });

    const response = await createRollback(rollbackRequest());
    const body: unknown = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ code: "service_unavailable" });
  });

  it("returns a coded conflict for a stale publish request", async () => {
    routeMocks.authenticatedRpc.mockResolvedValue(
      rpcFailure("stale_draft_version"),
    );

    const response = await publishDraft(publishRequest());
    const body: unknown = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ code: "stale_draft_version" });
  });

  it("returns service unavailable for a publish backend failure", async () => {
    routeMocks.authenticatedRpc.mockResolvedValue(
      rpcFailure("connection refused"),
    );

    const response = await publishDraft(publishRequest());
    const body: unknown = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ code: "service_unavailable" });
  });
});

function draftRequest() {
  const config = createDeterministicDraft({
    description: "A durable notebook designed for calm and focused daily work.",
  });
  return apiRequest("/api/store/draft", {
    config,
    parentVersionId: versionId,
    source: "manual_edit",
    storeId,
  });
}

function rollbackRequest() {
  return apiRequest("/api/store/rollback", {
    currentVersionId: versionId,
    storeId,
    targetVersionId,
  });
}

function publishRequest() {
  return apiRequest("/api/store/publish", {
    storeId,
    versionId,
  });
}

function apiRequest(path: string, body: Record<string, unknown>) {
  return new Request(`https://evolv.example${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": mutationKey,
    },
    body: JSON.stringify(body),
  });
}

function rpcFailure(message: string) {
  return {
    data: null,
    error: { code: "P0001", details: null, hint: null, message },
  };
}
