import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { Storefront } from "@/components/store/storefront";
import { createDeterministicDraft } from "@/lib/domain/generation";

it("renders working storefront navigation links", () => {
  const config = createDeterministicDraft({
    description: "A durable notebook designed for calm and focused daily work.",
    name: "Focus Book",
  });

  render(
    <Storefront
      config={config}
      product={{
        name: "Focus Book",
        description: "A durable notebook designed for focused daily work.",
        price: 24,
      }}
    />,
  );

  expect(screen.getByRole("link", { name: "Product" })).toHaveAttribute(
    "href",
    "#product",
  );
  expect(screen.getByRole("link", { name: "Details" })).toHaveAttribute(
    "href",
    "#benefits",
  );
  expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute(
    "href",
    "#faq",
  );
  expect(screen.queryByText("Menu")).toBeNull();
});

it("does not link to disabled storefront sections", () => {
  const config = createDeterministicDraft({
    description: "A durable notebook designed for calm and focused daily work.",
    name: "Focus Book",
  });
  config.enabledSections = ["header", "hero", "trust", "footer"];

  render(
    <Storefront
      config={config}
      product={{
        name: "Focus Book",
        description: "A durable notebook designed for focused daily work.",
        price: 24,
      }}
    />,
  );

  expect(screen.queryByRole("link", { name: "Product" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Details" })).toBeNull();
  expect(screen.queryByRole("link", { name: "FAQ" })).toBeNull();
});
