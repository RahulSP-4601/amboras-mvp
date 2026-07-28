import { Sparkles } from "lucide-react";
import Link from "next/link";
import { z } from "zod";

import { GoogleLogin } from "@/components/auth/google-login";

const loginErrorSchema = z.enum([
  "callback_failed",
  "missing_code",
  "signout_failed",
]);
const errorMessages: Record<z.infer<typeof loginErrorSchema>, string> = {
  callback_failed:
    "Google sign-in could not be completed. Please start the sign-in again.",
  missing_code:
    "Google sign-in did not return the required authorization code. Please try again.",
  signout_failed:
    "Sign-out could not be confirmed. Return to the app and try again.",
};

export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await props.searchParams;
  const errorCode = loginErrorSchema.safeParse(error).data;
  return (
    <main className="auth-page">
      <Link className="brand" href="/">
        <span className="brand-mark">
          <Sparkles size={17} />
        </span>
        Evolv
      </Link>
      <section className="auth-card">
        <p className="eyebrow">Welcome to Evolv</p>
        <h1>Build your first improving storefront.</h1>
        <p>
          Sign in to generate, publish, and learn from one focused product page.
        </p>
        <GoogleLogin />
        <LoginError code={errorCode} />
        <small>
          By continuing, you agree to use the product responsibly. No payment
          information is collected by this MVP.
        </small>
      </section>
    </main>
  );
}

function LoginError(props: {
  code: z.infer<typeof loginErrorSchema> | undefined;
}) {
  if (!props.code) return null;
  return (
    <p className="form-error" role="alert">
      {errorMessages[props.code]}
    </p>
  );
}
