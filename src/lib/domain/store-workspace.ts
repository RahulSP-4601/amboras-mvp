import { z } from "zod";

import type { ProductInput } from "@/lib/domain/product";
import { storeConfigSchema, type StoreConfig } from "@/lib/domain/store-config";
import { versionStatusSchema } from "@/lib/domain/versions";

export const versionSourceSchema = z.enum([
  "ai_generation",
  "manual_edit",
  "ai_edit",
  "rollback",
  "experiment",
]);

export const storeVersionSummarySchema = z
  .object({
    id: z.string().uuid(),
    versionNumber: z.number().int().positive(),
    status: versionStatusSchema,
    source: versionSourceSchema,
    parentVersionId: z.string().uuid().nullable(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const storeDraftMutationSchema = storeVersionSummarySchema
  .extend({
    config: storeConfigSchema,
  })
  .strict();

export interface DraftRecord {
  config: StoreConfig;
  product: ProductInput;
  generatedAt: string;
  persisted?: { storeId: string; versionId: string; slug: string } | null;
}

export interface StoreWorkspace {
  draft: DraftRecord;
  publishedConfig: StoreConfig | null;
  versions: StoreVersionSummary[];
}

export type StoreVersionSummary = z.infer<typeof storeVersionSummarySchema>;
export type StoreDraftMutation = z.infer<typeof storeDraftMutationSchema>;
