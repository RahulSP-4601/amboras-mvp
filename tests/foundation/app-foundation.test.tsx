import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import LandingPage from "@/app/page";
import { AppShell } from "@/components/app/app-shell";

describe("application foundation", () => {
  it("renders the product promise and primary action", () => {
    render(<LandingPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Build a store that improves itself.",
      }),
    ).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: /create your store/i }).length,
    ).toBeGreaterThan(0);
  });

  it("does not present excluded commercial navigation", () => {
    render(<LandingPage />);

    expect(
      screen.queryByRole("link", { name: /pricing|upgrade/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the persisted store identity in the application shell", () => {
    render(
      <AppShell storeName="Quiet Studio">
        <p>Workspace content</p>
      </AppShell>,
    );

    expect(screen.getByText("Quiet Studio")).toBeVisible();
    expect(screen.getByText("Q")).toHaveClass("store-avatar");
  });

  it("clears browser-scoped workspace data before signing out", () => {
    sessionStorage.setItem("evolv:generation-attempt", "{}");
    localStorage.setItem("evolv:draft", "{}");
    render(
      <AppShell>
        <p>Workspace content</p>
      </AppShell>,
    );

    const button = screen.getByRole("button", { name: "Sign out" });
    const form = button.closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    expect(sessionStorage.getItem("evolv:generation-attempt")).toBeNull();
    expect(localStorage.getItem("evolv:draft")).toBeNull();
  });
});
