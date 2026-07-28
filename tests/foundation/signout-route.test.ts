import { afterEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  configured: vi.fn(() => true),
  signOut: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  isSupabaseConfigured: authMocks.configured,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { signOut: authMocks.signOut } }),
}));

import { POST } from "@/app/auth/signout/route";

describe("sign-out route", () => {
  afterEach(() => {
    vi.clearAllMocks();
    authMocks.configured.mockReturnValue(true);
  });

  it("redirects home only after confirmed sign-out", async () => {
    authMocks.signOut.mockResolvedValue({ error: null });
    const response = await POST(
      new Request("https://evolv.example/auth/signout"),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://evolv.example/");
  });

  it("surfaces a provider sign-out failure", async () => {
    authMocks.signOut.mockResolvedValue({
      error: new Error("provider failed"),
    });
    const response = await POST(
      new Request("https://evolv.example/auth/signout"),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://evolv.example/login?error=signout_failed",
    );
  });
});
