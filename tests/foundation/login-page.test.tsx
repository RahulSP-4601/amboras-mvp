import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import LoginPage from "@/app/login/page";

describe("login route feedback", () => {
  it.each([
    [
      "callback_failed",
      "Google sign-in could not be completed. Please start the sign-in again.",
    ],
    [
      "missing_code",
      "Google sign-in did not return the required authorization code. Please try again.",
    ],
    [
      "signout_failed",
      "Sign-out could not be confirmed. Return to the app and try again.",
    ],
  ])("shows the expected %s error", async (error, message) => {
    render(await LoginPage({ searchParams: Promise.resolve({ error }) }));

    expect(screen.getByRole("alert")).toHaveTextContent(message);
  });

  it("does not render unrecognized query-string content", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({ error: "untrusted-message" }),
      }),
    );

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
