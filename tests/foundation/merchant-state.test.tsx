import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createDeterministicDraft } from "@/lib/domain/generation";
import type { StoreWorkspace } from "@/lib/domain/store-workspace";

const workspaceMocks = vi.hoisted(() => ({
  getOwnedStoreWorkspace: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  isSupabaseConfigured: () => true,
}));

vi.mock("@/lib/stores/owned-draft", () => ({
  getOwnedStoreWorkspace: workspaceMocks.getOwnedStoreWorkspace,
}));

import DashboardPage from "@/app/app/page";
import ProductPage from "@/app/app/product/page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("returning merchant states", () => {
  it("opens the existing store instead of restarting onboarding", async () => {
    workspaceMocks.getOwnedStoreWorkspace.mockResolvedValue(workspace());

    render(await DashboardPage());

    expect(
      screen.getByRole("link", { name: /open your store/i }),
    ).toHaveAttribute("href", "/app/store");
    expect(screen.queryByText("Create your first storefront")).toBeNull();
    expect(screen.getByText("3 of 4 complete")).toBeVisible();
  });

  it("renders the canonical persisted product", async () => {
    workspaceMocks.getOwnedStoreWorkspace.mockResolvedValue(workspace());

    render(await ProductPage());

    expect(screen.getByRole("heading", { name: "Focus Book" })).toBeVisible();
    expect(screen.getByText("Quiet Studio")).toBeVisible();
    expect(screen.queryByText("No product yet")).toBeNull();
    expect(screen.getByRole("link", { name: "Open store" })).toHaveAttribute(
      "href",
      "/app/store",
    );
  });

  it("keeps onboarding available for a genuinely empty account", async () => {
    workspaceMocks.getOwnedStoreWorkspace.mockResolvedValue(null);

    render(await DashboardPage());

    expect(
      screen.getByRole("link", { name: /create your store/i }),
    ).toHaveAttribute("href", "/app/onboarding");
  });

  it("does not present a service failure as an empty account", async () => {
    workspaceMocks.getOwnedStoreWorkspace.mockRejectedValue(
      new Error("Unable to load store."),
    );

    await expect(DashboardPage()).rejects.toThrow("Unable to load store.");
  });
});

function workspace(): StoreWorkspace {
  const config = createDeterministicDraft({
    description: "A durable notebook designed for calm and focused daily work.",
    name: "Focus Book",
    brandName: "Quiet Studio",
    price: 24,
  });
  return {
    draft: {
      config,
      product: {
        description:
          "A durable notebook designed for calm and focused daily work.",
        name: "Focus Book",
        brandName: "Quiet Studio",
        price: 24,
      },
      generatedAt: "2026-07-28T12:00:00.000Z",
      persisted: {
        storeId: "048c6691-5a11-4b32-b8e0-5c8ea31ce5df",
        versionId: "d63a3e31-c396-4e23-bb4f-d27d0f4d8805",
        slug: "focus-book",
      },
    },
    publishedConfig: config,
    versions: [
      {
        id: "d63a3e31-c396-4e23-bb4f-d27d0f4d8805",
        versionNumber: 1,
        status: "published",
        source: "ai_generation",
        parentVersionId: null,
        createdAt: "2026-07-28T12:00:00.000Z",
      },
    ],
  };
}
