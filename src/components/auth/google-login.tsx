"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/browser";

export function GoogleLogin() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    setError("");
    try {
      const client = createClient();
      const { error: authError } = await client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (authError) setError("Google sign-in could not be started.");
    } catch {
      setError("Authentication is not configured yet.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        className="google-button"
        disabled={pending}
        onClick={() => void signIn()}
        type="button"
      >
        <GoogleMark /> {pending ? "Opening Google…" : "Continue with Google"}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </>
  );
}

function GoogleMark() {
  return (
    <span aria-hidden="true" className="google-mark">
      G
    </span>
  );
}
