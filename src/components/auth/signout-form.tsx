"use client";

import { LogOut } from "lucide-react";

import { clearGenerationAttempt } from "@/lib/stores/generation-attempt";

export function SignOutForm() {
  return (
    <form action="/auth/signout" method="post" onSubmit={clearBrowserWorkspace}>
      <button className="sidebar-signout" type="submit">
        <LogOut size={17} /> Sign out
      </button>
    </form>
  );
}

function clearBrowserWorkspace() {
  try {
    clearGenerationAttempt();
    window.localStorage.removeItem("evolv:draft");
  } catch {
    // Browser storage is best-effort; the server still owns sign-out.
  }
}
