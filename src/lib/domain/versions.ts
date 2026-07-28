import { z } from "zod";

import { storeConfigSchema } from "@/lib/domain/store-config";

export const versionStatusSchema = z.enum(["draft", "published", "archived"]);

export const storeVersionSchema = z.object({
  id: z.string().uuid(),
  storeId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  config: storeConfigSchema,
  status: versionStatusSchema,
  source: z.enum([
    "ai_generation",
    "manual_edit",
    "ai_edit",
    "rollback",
    "experiment",
  ]),
  parentVersionId: z.string().uuid().nullable(),
  createdAt: z.string().datetime({ offset: true }),
});

export type StoreVersion = z.infer<typeof storeVersionSchema>;

export function publishVersion(
  versions: readonly StoreVersion[],
  draftId: string,
): StoreVersion[] {
  const draft = versions.find((version) => version.id === draftId);
  if (!draft || draft.status !== "draft") {
    throw new Error("Only an existing draft can be published");
  }

  return versions.map((version) => {
    if (version.id === draftId) return { ...version, status: "published" };
    if (version.status === "published")
      return { ...version, status: "archived" };
    return { ...version };
  });
}

export function createRollbackVersion(
  versions: readonly StoreVersion[],
  targetId: string,
  id: string,
  createdAt: string,
): StoreVersion {
  const target = versions.find((version) => version.id === targetId);
  if (!target) throw new Error("Rollback target does not exist");

  return {
    ...target,
    id,
    versionNumber:
      Math.max(...versions.map((version) => version.versionNumber)) + 1,
    status: "draft",
    source: "rollback",
    parentVersionId: target.id,
    createdAt,
  };
}
