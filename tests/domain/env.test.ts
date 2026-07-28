import { afterEach, describe, expect, it, vi } from "vitest";

import { getOpenAiApiKey, isSupabaseConfigured } from "@/lib/env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("environment credential detection", () => {
  it("keeps empty example values unconfigured", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");

    expect(isSupabaseConfigured()).toBe(false);
    expect(getOpenAiApiKey()).toBeNull();
  });

  it("rejects sentinel placeholders as credentials", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://your-project.supabase.co");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "sb_publishable_replace_me",
    );
    vi.stubEnv("OPENAI_API_KEY", "<replace-with-openai-key>");

    expect(isSupabaseConfigured()).toBe(false);
    expect(getOpenAiApiKey()).toBeNull();
  });
});
