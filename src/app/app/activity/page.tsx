import { Activity } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";

export default function ActivityPage() {
  return (
    <>
      <PageHeader
        eyebrow="AI Activity"
        title="Every important action, visible"
        description="AI, user, and system activity will be recorded here."
      />
      <div className="empty-panel compact">
        <span className="empty-icon">
          <Activity />
        </span>
        <h2>No activity yet</h2>
        <p>Generate your first store to begin the activity history.</p>
      </div>
    </>
  );
}
