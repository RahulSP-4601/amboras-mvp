import { z } from "zod";

const placeholderPattern = /replace|your-project|[<>]/i;
const credentialSchema = z
  .string()
  .min(20)
  .refine((value) => !placeholderPattern.test(value), "Placeholder credential");
const supabaseUrlSchema = z
  .string()
  .url()
  .refine((value) => !placeholderPattern.test(value), "Placeholder URL");

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrlSchema,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: credentialSchema,
});

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: credentialSchema,
  OPENAI_API_KEY: credentialSchema,
  EXPERIMENT_ASSIGNMENT_SECRET: credentialSchema.min(32),
});

const adminSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: credentialSchema,
});

const aiLimitSchema = z.object({
  generation: z.coerce.number().int().min(1).max(1_000).default(20),
  proposal: z.coerce.number().int().min(1).max(1_000).default(60),
});

export function getPublicEnv() {
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

export function getServerEnv() {
  return serverSchema.parse({
    ...getPublicEnv(),
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    EXPERIMENT_ASSIGNMENT_SECRET: process.env.EXPERIMENT_ASSIGNMENT_SECRET,
  });
}

export function getAdminEnv() {
  return adminSchema.parse({
    ...getPublicEnv(),
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}

export function isSupabaseConfigured(): boolean {
  return publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  }).success;
}

export function getOpenAiApiKey(): string | null {
  return credentialSchema.safeParse(process.env.OPENAI_API_KEY).data ?? null;
}

export function getAiRequestLimits() {
  return aiLimitSchema.parse({
    generation: process.env.AI_GENERATION_REQUESTS_PER_HOUR,
    proposal: process.env.AI_PROPOSAL_REQUESTS_PER_HOUR,
  });
}
