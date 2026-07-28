import { expect, test } from "@playwright/test";

test("landing presents the focused MVP promise", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Build a store that improves itself." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create your store" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /pricing|upgrade/i }),
  ).toHaveCount(0);
});

test("mobile fallback navigation keeps sign-out available", async ({
  page,
}) => {
  await page.goto("/app");

  await expect(page.getByRole("link", { name: "Analytics" })).toBeVisible();
  await expect(page.getByRole("link", { name: "AI Activity" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
});
