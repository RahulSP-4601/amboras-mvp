import { StoreBuilder } from "@/components/store/store-builder";
import "@/components/store/storefront.css";
import { isSupabaseConfigured } from "@/lib/env";
import { getOwnedStoreWorkspace } from "@/lib/stores/owned-draft";
import "./store.css";

export default async function StorePage() {
  const configured = isSupabaseConfigured();
  const workspace = configured ? await getOwnedStoreWorkspace() : null;
  return (
    <StoreBuilder
      allowLocalDraft={!configured}
      initialDraft={workspace?.draft}
      initialPublishedConfig={workspace?.publishedConfig}
      initialVersions={workspace?.versions}
    />
  );
}
