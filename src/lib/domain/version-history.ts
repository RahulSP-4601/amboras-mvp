import type {
  DraftRecord,
  StoreDraftMutation,
  StoreVersionSummary,
} from "@/lib/domain/store-workspace";

export function addVersion(
  versions: StoreVersionSummary[],
  created: StoreDraftMutation | null,
  replacedVersionId?: string,
): StoreVersionSummary[] {
  if (!created) return versions;
  const summary: StoreVersionSummary = {
    id: created.id,
    versionNumber: created.versionNumber,
    status: created.status,
    source: created.source,
    parentVersionId: created.parentVersionId,
    createdAt: created.createdAt,
  };
  const history = versions
    .filter((version) => version.id !== summary.id)
    .map((version) => archiveReplacedDraft(version, replacedVersionId));
  return [summary, ...history];
}

export function markPublished(
  versions: StoreVersionSummary[],
  draft: DraftRecord,
): StoreVersionSummary[] {
  const id = draft.persisted?.versionId;
  if (!id) return versions;
  return versions.map((version) => {
    if (version.id === id) return { ...version, status: "published" };
    if (version.status === "published") {
      return { ...version, status: "archived" };
    }
    return version;
  });
}

function archiveReplacedDraft(
  version: StoreVersionSummary,
  replacedVersionId?: string,
): StoreVersionSummary {
  if (version.id !== replacedVersionId || version.status !== "draft") {
    return version;
  }
  return { ...version, status: "archived" };
}
