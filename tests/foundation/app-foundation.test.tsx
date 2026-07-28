import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("application foundation", () => {
  it("renders the starter page without a runtime failure", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "To get started, edit the page.tsx file.",
      }),
    ).toBeVisible();
  });

  it("protects external links from opener access", () => {
    render(<Home />);

    const links = screen.getAllByRole("link");
    const externalLinks = links.filter(
      (link) => link.getAttribute("target") === "_blank",
    );

    expect(externalLinks.length).toBeGreaterThan(0);
    expect(externalLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rel: "noopener noreferrer",
        }),
      ]),
    );
  });
});
