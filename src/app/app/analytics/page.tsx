import { BarChart3 } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Analytics"
        title="Behaviour, not invented numbers"
        description="Live visitor data is always the default view."
      />
      <div className="notice">Live traffic · No data yet</div>
      <div className="empty-panel compact">
        <span className="empty-icon">
          <BarChart3 />
        </span>
        <h2>Waiting for visitors</h2>
        <p>
          Validated funnel events will appear after your store is published.
        </p>
      </div>
    </>
  );
}
