"use client";

import { RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";

import type { StoreEditProposal } from "@/lib/domain/store-edit";
import type { StoreConfig } from "@/lib/domain/store-config";
import type { StoreVersionSummary } from "@/lib/domain/store-workspace";

export function StoreEditor(props: {
  config: StoreConfig;
  update: (
    field: "heroHeadline" | "heroSupportingText" | "ctaText",
    value: string,
  ) => void;
  proposal: StoreEditProposal | null;
  pending: boolean;
  versions: StoreVersionSummary[];
  currentVersionId?: string;
  onRequestProposal: (instruction: string) => void;
  onApplyProposal: () => void;
  onDiscardProposal: () => void;
  onRollback: (version: StoreVersionSummary) => void;
}) {
  return (
    <aside className="store-editor">
      <div>
        <p>Homepage</p>
        <h2>Hero content</h2>
      </div>
      <HeroContentFields
        config={props.config}
        pending={props.pending}
        update={props.update}
      />
      <AiEditPanel {...props} />
      <VersionHistory
        currentVersionId={props.currentVersionId}
        onRollback={props.onRollback}
        pending={props.pending}
        versions={props.versions}
      />
    </aside>
  );
}

function HeroContentFields(
  props: Pick<
    Parameters<typeof StoreEditor>[0],
    "config" | "pending" | "update"
  >,
) {
  return (
    <>
      <EditorField
        disabled={props.pending}
        label="Headline"
        maxLength={120}
        onChange={(value) => props.update("heroHeadline", value)}
        value={props.config.heroHeadline}
      />
      <EditorField
        disabled={props.pending}
        label="Supporting copy"
        maxLength={500}
        onChange={(value) => props.update("heroSupportingText", value)}
        textarea
        value={props.config.heroSupportingText}
      />
      <EditorField
        disabled={props.pending}
        label="Button text"
        maxLength={40}
        onChange={(value) => props.update("ctaText", value)}
        value={props.config.ctaText}
      />
    </>
  );
}

function AiEditPanel(props: {
  config: StoreConfig;
  proposal: StoreEditProposal | null;
  pending: boolean;
  onRequestProposal: (instruction: string) => void;
  onApplyProposal: () => void;
  onDiscardProposal: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  if (props.proposal) {
    return (
      <ProposalReview
        config={props.config}
        onApplyProposal={props.onApplyProposal}
        onDiscardProposal={props.onDiscardProposal}
        pending={props.pending}
        proposal={props.proposal}
      />
    );
  }
  return (
    <form
      className="ai-edit-panel"
      onSubmit={(event) => {
        event.preventDefault();
        props.onRequestProposal(instruction);
      }}
    >
      <p>
        <Sparkles size={14} /> AI-assisted edit
      </p>
      <textarea
        maxLength={500}
        onChange={(event) => setInstruction(event.target.value)}
        placeholder="Example: make the headline more direct"
        rows={3}
        value={instruction}
      />
      <button
        disabled={props.pending || instruction.trim().length < 3}
        type="submit"
      >
        Propose change
      </button>
    </form>
  );
}

function ProposalReview(props: {
  config: StoreConfig;
  proposal: StoreEditProposal;
  pending: boolean;
  onApplyProposal: () => void;
  onDiscardProposal: () => void;
}) {
  return (
    <section className="proposal-review">
      <p>AI proposal · not applied</p>
      <h3>{props.proposal.summary}</h3>
      <span>{props.proposal.rationale}</span>
      {props.proposal.changes.map((change) => (
        <div className="proposal-change" key={change.field}>
          <small>{fieldLabel(change.field)}</small>
          <del>{props.config[change.field]}</del>
          <ins>{change.value}</ins>
        </div>
      ))}
      <div className="proposal-actions">
        <button
          disabled={props.pending}
          onClick={props.onDiscardProposal}
          type="button"
        >
          Discard
        </button>
        <button
          disabled={props.pending}
          onClick={props.onApplyProposal}
          type="button"
        >
          Apply as draft
        </button>
      </div>
    </section>
  );
}

function VersionHistory(props: {
  versions: StoreVersionSummary[];
  currentVersionId?: string;
  pending: boolean;
  onRollback: (version: StoreVersionSummary) => void;
}) {
  if (props.versions.length === 0) {
    return (
      <div className="version-note">
        <RotateCcw size={16} /> Version history appears after persistence.
      </div>
    );
  }
  return (
    <section className="version-history">
      <p>Version history</p>
      {props.versions.map((version) => (
        <VersionRow key={version.id} {...props} version={version} />
      ))}
    </section>
  );
}

function VersionRow(props: {
  version: StoreVersionSummary;
  currentVersionId?: string;
  pending: boolean;
  onRollback: (version: StoreVersionSummary) => void;
}) {
  const canRollback =
    props.version.id !== props.currentVersionId &&
    props.version.status !== "draft";
  return (
    <div className="version-row">
      <span>
        <strong>v{props.version.versionNumber}</strong>
        <small>
          {sourceLabel(props.version.source)} · {props.version.status}
        </small>
      </span>
      {canRollback ? (
        <button
          disabled={props.pending}
          onClick={() => props.onRollback(props.version)}
          type="button"
        >
          Restore
        </button>
      ) : (
        <i>{props.version.id === props.currentVersionId ? "Current" : ""}</i>
      )}
    </div>
  );
}

function EditorField(props: {
  disabled: boolean;
  label: string;
  maxLength: number;
  value: string;
  textarea?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="editor-field">
      <span>{props.label}</span>
      {props.textarea ? (
        <textarea
          aria-invalid={!props.value.trim()}
          disabled={props.disabled}
          maxLength={props.maxLength}
          minLength={1}
          onChange={(event) => props.onChange(event.target.value)}
          required
          rows={5}
          value={props.value}
        />
      ) : (
        <input
          aria-invalid={!props.value.trim()}
          disabled={props.disabled}
          maxLength={props.maxLength}
          minLength={1}
          onChange={(event) => props.onChange(event.target.value)}
          required
          value={props.value}
        />
      )}
    </label>
  );
}

function fieldLabel(field: string): string {
  if (field === "heroHeadline") return "Headline";
  if (field === "heroSupportingText") return "Supporting copy";
  return "Button text";
}

function sourceLabel(source: StoreVersionSummary["source"]): string {
  return source.replaceAll("_", " ");
}
