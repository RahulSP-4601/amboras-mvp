import {
  ArrowRight,
  BarChart3,
  Eye,
  FlaskConical,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/app/page-header";
import { resolveProductName } from "@/lib/domain/product";
import type { StoreWorkspace } from "@/lib/domain/store-workspace";
import { isSupabaseConfigured } from "@/lib/env";
import { getOwnedStoreWorkspace } from "@/lib/stores/owned-draft";

export default async function DashboardPage() {
  const workspace = isSupabaseConfigured()
    ? await getOwnedStoreWorkspace()
    : null;
  const hasStore = Boolean(workspace);
  return (
    <>
      <PageHeader
        action={
          <Link
            className="button app-primary"
            href={hasStore ? "/app/store" : "/app/onboarding"}
          >
            {hasStore ? "Open your store" : "Create your store"}{" "}
            <ArrowRight size={17} />
          </Link>
        }
        description={
          hasStore
            ? "Review, improve, and publish your focused storefront."
            : "Build the first version of your self-improving storefront."
        }
        eyebrow="My workspace"
        title="Good afternoon."
      />
      <DashboardMetrics />
      <DashboardSetup workspace={workspace} />
    </>
  );
}

function DashboardMetrics() {
  return (
    <section className="metric-grid">
      <Metric icon={<Eye />} label="Unique visitors" value="—" />
      <Metric icon={<BarChart3 />} label="Conversion rate" value="—" />
      <Metric icon={<FlaskConical />} label="Active experiment" value="None" />
    </section>
  );
}

function DashboardSetup({ workspace }: { workspace: StoreWorkspace | null }) {
  if (workspace) return <ExistingStoreSetup workspace={workspace} />;
  return (
    <section className="dashboard-grid">
      <div className="empty-panel">
        <span className="empty-icon">
          <Sparkles />
        </span>
        <h2>Create your first storefront</h2>
        <p>Describe one product and generate a structured draft you control.</p>
        <Link className="button app-primary" href="/app/onboarding">
          Start with a product
        </Link>
      </div>
      <SetupChecklist completed={1} />
    </section>
  );
}

function ExistingStoreSetup({ workspace }: { workspace: StoreWorkspace }) {
  const published = workspace.versions.some(
    (version) => version.status === "published",
  );
  return (
    <section className="dashboard-grid">
      <div className="empty-panel">
        <span className="empty-icon">
          <Sparkles />
        </span>
        <h2>{resolveProductName(workspace.draft.product)} is ready</h2>
        <p>
          {published
            ? "Your storefront is published and ready for visitor activity."
            : "Review the generated draft and publish it when you are ready."}
        </p>
        <Link className="button app-primary" href="/app/store">
          {published ? "Manage storefront" : "Review draft"}
        </Link>
      </div>
      <SetupChecklist completed={published ? 3 : 2} />
    </section>
  );
}

function SetupChecklist({ completed }: { completed: number }) {
  const items = [
    "Sign in",
    "Add your product",
    "Publish your store",
    "Run an experiment",
  ];
  return (
    <aside className="setup-card">
      <p>Getting started</p>
      <h3>{completed} of 4 complete</h3>
      <div className="progress">
        <span style={{ width: `${completed * 25}%` }} />
      </div>
      {items.map((item, index) => (
        <div className="setup-item" key={item}>
          <span className={index < completed ? "done" : ""}>
            {index < completed ? "✓" : ""}
          </span>
          {item}
        </div>
      ))}
    </aside>
  );
}

function Metric(props: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <article className="metric-card">
      <span>{props.icon}</span>
      <p>{props.label}</p>
      <strong>{props.value}</strong>
    </article>
  );
}
