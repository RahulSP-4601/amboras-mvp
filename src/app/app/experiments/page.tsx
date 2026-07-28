import { FlaskConical } from "lucide-react";

import { PageHeader } from "@/components/app/page-header";

export default function ExperimentsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Experiments"
        title="Test one improvement at a time"
        description="Experiments become available after your first store is published."
      />
      <div className="empty-panel compact">
        <span className="empty-icon">
          <FlaskConical />
        </span>
        <h2>No experiments yet</h2>
        <p>Publish a storefront before creating a cold-start hypothesis.</p>
      </div>
    </>
  );
}
