import { z } from "zod";

import { productInputSchema } from "@/lib/domain/product";

const uploadPathPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

const uploadedImageSchema = z
  .object({
    path: z.string().regex(uploadPathPattern),
    publicUrl: z.string().url().max(2_000),
  })
  .strict();

export const generationOwnerScopeSchema = z.union([
  z.string().uuid(),
  z.literal("local-preview"),
]);

export const generationAttemptSchema = z
  .object({
    input: productInputSchema,
    uploaded: uploadedImageSchema.optional(),
  })
  .strict()
  .refine(
    ({ input, uploaded }) => input.imageUrl === uploaded?.publicUrl,
    "Stored image metadata does not match the generation input",
  );

export const generationRecordSchema = z
  .object({
    key: z.string().uuid(),
    ownerScope: generationOwnerScopeSchema,
    attempt: generationAttemptSchema,
  })
  .strict();

export type GenerationAttempt = z.infer<typeof generationAttemptSchema>;
export type GenerationOwnerScope = z.infer<typeof generationOwnerScopeSchema>;
export type GenerationRecord = z.infer<typeof generationRecordSchema>;
