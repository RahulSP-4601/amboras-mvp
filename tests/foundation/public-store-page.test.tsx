import { expect, it, vi } from "vitest";

const publicStoreMocks = vi.hoisted(() => ({
  getPublicStore: vi.fn(),
}));

vi.mock("@/lib/stores/public-store", () => ({
  getPublicStore: publicStoreMocks.getPublicStore,
}));

import PublicStorePage from "@/app/s/[slug]/page";

it("preserves public store service failures", async () => {
  publicStoreMocks.getPublicStore.mockRejectedValue(
    new Error("Unable to load public store."),
  );

  await expect(
    PublicStorePage({ params: Promise.resolve({ slug: "focus-book" }) }),
  ).rejects.toThrow("Unable to load public store.");
});
