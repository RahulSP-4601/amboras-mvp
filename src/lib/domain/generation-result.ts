import { z } from "zod";

import { storeConfigSchema } from "@/lib/domain/store-config";

export const persistedStoreSchema = z
  .object({
    storeId: z.string().uuid(),
    versionId: z.string().uuid(),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  })
  .strict();

export const generationResponseSchema = z
  .object({
    config: storeConfigSchema,
    mode: z.enum(["openai", "local_preview"]),
    persisted: persistedStoreSchema.nullable(),
  })
  .strict();

export type GenerationResponse = z.infer<typeof generationResponseSchema>;
