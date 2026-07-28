"use client";

import { ExternalLink, Monitor, Save, Smartphone } from "lucide-react";
import {
  type Dispatch,
  type SetStateAction,
  useState,
  useSyncExternalStore,
} from "react";

import { StoreEditor } from "@/components/store/store-editor";
import { Storefront } from "@/components/store/storefront";
import {
  applyStoreEditProposal,
  type StoreEditProposal,
} from "@/lib/domain/store-edit";
import { storeConfigSchema, type StoreConfig } from "@/lib/domain/store-config";
import { resolveProductName } from "@/lib/domain/product";
import {
  type DraftRecord,
  type StoreDraftMutation,
  type StoreVersionSummary,
} from "@/lib/domain/store-workspace";
import { addVersion, markPublished } from "@/lib/domain/version-history";
import {
  fetchProposal,
  readStoredDraft,
  requestDraft,
  requestPublish,
  requestRollback,
  storeDraft,
} from "@/lib/stores/builder-client";

export function StoreBuilder(props: {
  allowLocalDraft?: boolean;
  initialDraft?: DraftRecord | null;
  initialPublishedConfig?: StoreConfig | null;
  initialVersions?: StoreVersionSummary[] | null;
}) {
  const model = useBuilderModel(props);
  if (!model.draft) return <MissingDraft />;
  return <BuilderView model={model} />;
}

interface BuilderModel {
  draft: DraftRecord | null;
  setDraft: Dispatch<SetStateAction<DraftRecord | null>>;
  versions: StoreVersionSummary[];
  setVersions: Dispatch<SetStateAction<StoreVersionSummary[]>>;
  viewport: "desktop" | "mobile";
  setViewport: Dispatch<SetStateAction<"desktop" | "mobile">>;
  previewMode: "draft" | "published";
  setPreviewMode: Dispatch<SetStateAction<"draft" | "published">>;
  publishedConfig: StoreConfig | null;
  setPublishedConfig: Dispatch<SetStateAction<StoreConfig | null>>;
  status: string;
  setStatus: Dispatch<SetStateAction<string>>;
  dirty: boolean;
  setDirty: Dispatch<SetStateAction<boolean>>;
  pending: boolean;
  setPending: Dispatch<SetStateAction<boolean>>;
  proposal: StoreEditProposal | null;
  setProposal: Dispatch<SetStateAction<StoreEditProposal | null>>;
}

function useBuilderModel(props: {
  allowLocalDraft?: boolean;
  initialDraft?: DraftRecord | null;
  initialPublishedConfig?: StoreConfig | null;
  initialVersions?: StoreVersionSummary[] | null;
}): BuilderModel {
  const [draft, setDraft] = useInitialDraft(props);
  const [versions, setVersions] = useState(props.initialVersions || []);
  const initialPresentation = initialBuilderPresentation(props);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [previewMode, setPreviewMode] = useState<"draft" | "published">(
    initialPresentation.previewMode,
  );
  const [publishedConfig, setPublishedConfig] = useState<StoreConfig | null>(
    props.initialPublishedConfig ?? null,
  );
  const [status, setStatus] = useState<string>(initialPresentation.status);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [proposal, setProposal] = useState<StoreEditProposal | null>(null);
  return {
    draft,
    setDraft,
    versions,
    setVersions,
    viewport,
    setViewport,
    previewMode,
    setPreviewMode,
    publishedConfig,
    setPublishedConfig,
    status,
    setStatus,
    dirty,
    setDirty,
    pending,
    setPending,
    proposal,
    setProposal,
  };
}

function initialBuilderPresentation(props: {
  initialDraft?: DraftRecord | null;
  initialPublishedConfig?: StoreConfig | null;
  initialVersions?: StoreVersionSummary[] | null;
}) {
  const currentId = props.initialDraft?.persisted?.versionId;
  const current = props.initialVersions?.find(
    (version) => version.id === currentId,
  );
  const published = current?.status === "published";
  return {
    previewMode:
      published && props.initialPublishedConfig ? "published" : "draft",
    status: published ? "Published" : "Draft",
  } as const;
}

function useInitialDraft(props: {
  allowLocalDraft?: boolean;
  initialDraft?: DraftRecord | null;
}) {
  const state = useState<DraftRecord | null>(props.initialDraft ?? null);
  const storedDraft = useSyncExternalStore(
    subscribeStoredDraft,
    readStoredDraft,
    noStoredDraft,
  );
  return [
    state[0] ?? (props.allowLocalDraft ? storedDraft : null),
    state[1],
  ] as const;
}

function subscribeStoredDraft() {
  return () => undefined;
}

function noStoredDraft() {
  return null;
}

function BuilderView({ model }: { model: BuilderModel }) {
  const draft = model.draft;
  if (!draft) return <MissingDraft />;
  const currentStatus = model.versions.find(
    (version) => version.id === draft.persisted?.versionId,
  )?.status;
  const published = model.versions.some((item) => item.status === "published");
  const validDraft = storeConfigSchema.safeParse(draft.config).success;
  const previewConfig = selectPreviewConfig(model, draft);
  return (
    <div className="builder">
      <BuilderToolbar
        canPublish={
          validDraft &&
          !model.pending &&
          (model.dirty || currentStatus !== "published")
        }
        pending={model.pending}
        publish={() => void publishAction(model, draft)}
        publicSlug={published ? draft.persisted?.slug : undefined}
        previewMode={model.previewMode}
        publishedPreviewAvailable={Boolean(model.publishedConfig)}
        setPreviewMode={model.setPreviewMode}
        setViewport={model.setViewport}
        status={model.status}
        viewport={model.viewport}
      />
      <div className="builder-grid">
        <StoreEditor
          config={draft.config}
          currentVersionId={draft.persisted?.versionId}
          onApplyProposal={() => void applyProposalAction(model, draft)}
          onDiscardProposal={() => model.setProposal(null)}
          onRequestProposal={(value) =>
            void proposalAction(model, draft, value)
          }
          onRollback={(version) => void rollbackAction(model, draft, version)}
          pending={model.pending}
          proposal={model.proposal}
          update={(field, value) => updateAction(model, draft, field, value)}
          versions={model.versions}
        />
        <div className={`preview-frame ${model.viewport}`}>
          <Storefront config={previewConfig} product={previewProduct(draft)} />
        </div>
      </div>
    </div>
  );
}

function selectPreviewConfig(model: BuilderModel, draft: DraftRecord) {
  return model.previewMode === "published" && model.publishedConfig
    ? model.publishedConfig
    : draft.config;
}

function updateAction(
  model: BuilderModel,
  draft: DraftRecord,
  field: "heroHeadline" | "heroSupportingText" | "ctaText",
  value: string,
) {
  const next = updateDraftField(draft, field, value);
  model.setDraft(next);
  storeDraft(next);
  model.setDirty(true);
  model.setProposal(null);
  model.setStatus(
    storeConfigSchema.safeParse(next.config).success
      ? "Unsaved changes"
      : "Review highlighted fields",
  );
}

async function publishAction(model: BuilderModel, draft: DraftRecord) {
  const replacedVersionId = draft.persisted?.versionId;
  model.setPending(true);
  model.setStatus("Publishing…");
  try {
    const prepared = await prepareForPublish(draft, model.dirty);
    if (prepared.created) {
      model.setDraft(prepared.draft);
      storeDraft(prepared.draft);
      model.setVersions((current) =>
        addVersion(current, prepared.created, replacedVersionId),
      );
      model.setDirty(false);
    }
    if (prepared.draft.persisted) {
      await requestPublish(
        prepared.draft.persisted.storeId,
        prepared.draft.persisted.versionId,
      );
    }
    model.setDraft(prepared.draft);
    storeDraft(prepared.draft);
    model.setVersions((current) =>
      markPublished(
        addVersion(current, prepared.created, replacedVersionId),
        prepared.draft,
      ),
    );
    model.setPublishedConfig(prepared.draft.config);
    model.setPreviewMode("published");
    model.setDirty(false);
    model.setStatus(
      prepared.draft.persisted ? "Published" : "Published in local preview",
    );
  } catch {
    model.setStatus("Publish failed");
  } finally {
    model.setPending(false);
  }
}

async function proposalAction(
  model: BuilderModel,
  draft: DraftRecord,
  instruction: string,
) {
  model.setPending(true);
  model.setStatus("Preparing AI proposal…");
  try {
    model.setProposal(
      await fetchProposal(draft.config, instruction, draft.persisted?.storeId),
    );
    model.setStatus("Proposal ready · review before applying");
  } catch {
    model.setStatus("Proposal failed");
  } finally {
    model.setPending(false);
  }
}

async function applyProposalAction(model: BuilderModel, draft: DraftRecord) {
  if (!model.proposal) return;
  const replacedVersionId = draft.persisted?.versionId;
  model.setPending(true);
  try {
    const config = applyStoreEditProposal(draft.config, model.proposal);
    const applied = await applyProposedDraft(draft, config);
    model.setDraft(applied.draft);
    storeDraft(applied.draft);
    model.setVersions((current) =>
      addVersion(current, applied.created, replacedVersionId),
    );
    model.setDirty(!draft.persisted);
    model.setProposal(null);
    model.setStatus("AI proposal applied as a new draft");
  } catch {
    model.setStatus("Proposal could not be applied");
  } finally {
    model.setPending(false);
  }
}

async function rollbackAction(
  model: BuilderModel,
  draft: DraftRecord,
  version: StoreVersionSummary,
) {
  if (!draft.persisted) return;
  const replacedVersionId = draft.persisted.versionId;
  if (
    !window.confirm(`Create a rollback draft from v${version.versionNumber}?`)
  )
    return;
  model.setPending(true);
  try {
    const created = await requestRollback(
      draft.persisted.storeId,
      draft.persisted.versionId,
      version.id,
    );
    const next = draftWithVersion(draft, created);
    model.setDraft(next);
    storeDraft(next);
    model.setVersions((current) =>
      addVersion(current, created, replacedVersionId),
    );
    model.setDirty(false);
    model.setProposal(null);
    model.setStatus(`Rollback draft v${created.versionNumber} ready`);
  } catch {
    model.setStatus("Rollback failed");
  } finally {
    model.setPending(false);
  }
}

function BuilderToolbar(props: {
  status: string;
  viewport: "desktop" | "mobile";
  setViewport: (viewport: "desktop" | "mobile") => void;
  publish: () => void;
  canPublish: boolean;
  pending: boolean;
  publicSlug?: string;
  previewMode: "draft" | "published";
  publishedPreviewAvailable: boolean;
  setPreviewMode: (mode: "draft" | "published") => void;
}) {
  return (
    <div className="builder-toolbar">
      <div>
        <p>Store builder</p>
        <span className="status-pill">{props.status}</span>
      </div>
      <BuilderPreviewControls {...props} />
      <div className="builder-actions">
        {props.publicSlug ? (
          <a href={`/s/${props.publicSlug}`} rel="noreferrer" target="_blank">
            View live <ExternalLink size={14} />
          </a>
        ) : null}
        <button
          className="button app-primary"
          disabled={!props.canPublish || props.pending}
          onClick={props.publish}
          type="button"
        >
          <Save size={16} /> Publish
        </button>
      </div>
    </div>
  );
}

function BuilderPreviewControls(props: {
  viewport: "desktop" | "mobile";
  setViewport: (viewport: "desktop" | "mobile") => void;
  previewMode: "draft" | "published";
  publishedPreviewAvailable: boolean;
  setPreviewMode: (mode: "draft" | "published") => void;
}) {
  return (
    <div className="builder-preview-controls">
      <div className="viewport-toggle">
        <ViewportButton
          active={props.viewport === "desktop"}
          icon={<Monitor size={16} />}
          label="Desktop"
          select={() => props.setViewport("desktop")}
        />
        <ViewportButton
          active={props.viewport === "mobile"}
          icon={<Smartphone size={16} />}
          label="Mobile"
          select={() => props.setViewport("mobile")}
        />
      </div>
      <div className="viewport-toggle">
        <ViewportButton
          active={props.previewMode === "draft"}
          label="Draft"
          select={() => props.setPreviewMode("draft")}
        />
        <ViewportButton
          active={props.previewMode === "published"}
          disabled={!props.publishedPreviewAvailable}
          label="Published"
          select={() => props.setPreviewMode("published")}
        />
      </div>
    </div>
  );
}

function ViewportButton(props: {
  active: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  label: string;
  select: () => void;
}) {
  return (
    <button
      className={props.active ? "active" : ""}
      disabled={props.disabled}
      onClick={props.select}
      type="button"
    >
      {props.icon} {props.label}
    </button>
  );
}

function previewProduct(draft: DraftRecord) {
  return {
    name: resolveProductName(draft.product),
    description: draft.product.description,
    price: draft.product.price ?? null,
    imageUrl: draft.product.imageUrl,
  };
}

async function prepareForPublish(draft: DraftRecord, dirty: boolean) {
  if (!draft.persisted || !dirty) return { draft, created: null };
  const created = await requestDraft(draft, draft.config, "manual_edit");
  return { draft: draftWithVersion(draft, created), created };
}

async function applyProposedDraft(
  draft: DraftRecord,
  config: DraftRecord["config"],
) {
  if (!draft.persisted) {
    return { draft: { ...draft, config }, created: null };
  }
  const created = await requestDraft(draft, config, "ai_edit");
  return { draft: draftWithVersion(draft, created), created };
}

function draftWithVersion(
  draft: DraftRecord,
  version: StoreDraftMutation,
): DraftRecord {
  if (!draft.persisted) return draft;
  return {
    ...draft,
    config: version.config,
    generatedAt: version.createdAt,
    persisted: { ...draft.persisted, versionId: version.id },
  };
}

function updateDraftField(
  draft: DraftRecord,
  field: "heroHeadline" | "heroSupportingText" | "ctaText",
  value: string,
): DraftRecord {
  return { ...draft, config: { ...draft.config, [field]: value } };
}

function MissingDraft() {
  return (
    <div className="empty-panel compact">
      <h2>No draft store yet</h2>
      <p>Generate a storefront from onboarding before opening the builder.</p>
      <a className="button app-primary" href="/app/onboarding">
        Generate a store
      </a>
    </div>
  );
}
