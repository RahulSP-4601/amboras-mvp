import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import {
  generationOwnerScopeSchema,
  type GenerationOwnerScope,
} from "@/lib/domain/generation-attempt";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  const ownerScope = await getOwnerScope();
  return (
    <div className="onboarding-page">
      <div className="onboarding-heading">
        <p>Store setup · Step 1 of 1</p>
        <h1>What do you want to sell?</h1>
        <span>
          Start with one product. You can review every generated field before
          publishing.
        </span>
      </div>
      <OnboardingForm ownerScope={ownerScope} />
    </div>
  );
}

async function getOwnerScope(): Promise<GenerationOwnerScope> {
  if (!isSupabaseConfigured()) return "local-preview";
  const client = await createClient();
  const { data: auth, error } = await client.auth.getUser();
  if (error) {
    throw new Error("Unable to verify the onboarding account.", {
      cause: error,
    });
  }
  if (!auth.user) redirect("/login");
  return generationOwnerScopeSchema.parse(auth.user.id);
}
