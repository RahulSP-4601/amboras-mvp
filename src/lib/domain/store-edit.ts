import { z } from "zod";

import { storeConfigSchema, type StoreConfig } from "@/lib/domain/store-config";

export const editableStoreFieldSchema = z.enum([
  "heroHeadline",
  "heroSupportingText",
  "ctaText",
]);

export const storeEditProposalSchema = z
  .object({
    summary: z.string().trim().min(1).max(160),
    rationale: z.string().trim().min(1).max(300),
    changes: z
      .array(
        z
          .object({
            field: editableStoreFieldSchema,
            value: z.string().trim().min(1).max(500),
          })
          .strict(),
      )
      .min(1)
      .max(3),
  })
  .strict()
  .superRefine((proposal, context) => {
    const fields = proposal.changes.map((change) => change.field);
    if (new Set(fields).size !== fields.length) {
      context.addIssue({ code: "custom", message: "Duplicate proposal field" });
    }
  });

export type StoreEditProposal = z.infer<typeof storeEditProposalSchema>;

export function applyStoreEditProposal(
  config: StoreConfig,
  proposal: StoreEditProposal,
): StoreConfig {
  const next: StoreConfig = { ...config };
  for (const change of proposal.changes) {
    next[change.field] = change.value;
  }
  return storeConfigSchema.parse(next);
}
