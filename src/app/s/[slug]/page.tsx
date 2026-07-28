import { notFound } from "next/navigation";

import { PublicStorefront } from "@/components/store/public-storefront";
import "@/components/store/storefront.css";
import { getPublicStore } from "@/lib/stores/public-store";
import "./public-store.css";

export default async function PublicStorePage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const store = await getPublicStore(slug);
  if (!store) notFound();

  return (
    <main>
      <PublicStorefront
        config={store.config}
        product={store.product}
        slug={slug}
      />
    </main>
  );
}
