import { z } from "zod";

export const generationStageSchema = z.enum([
  "validating_product",
  "preparing_store_brief",
  "generating_storefront",
  "validating_generated_content",
  "saving_draft_version",
]);

export type GenerationStage = z.infer<typeof generationStageSchema>;
