import Image from "next/image";
import Link from "next/link";

import { PageHeader } from "@/components/app/page-header";
import { resolveProductName, type ProductInput } from "@/lib/domain/product";
import { isSupabaseConfigured } from "@/lib/env";
import { getOwnedStoreWorkspace } from "@/lib/stores/owned-draft";

export default async function ProductPage() {
  const workspace = isSupabaseConfigured()
    ? await getOwnedStoreWorkspace()
    : null;
  const product = workspace?.draft.product ?? null;
  const brandName = workspace?.draft.config.brandName;
  return (
    <>
      <PageHeader
        eyebrow="Product"
        title="Your product"
        description="The canonical product record that powers every store version."
        action={
          <Link
            className="button app-primary"
            href={product ? "/app/store" : "/app/onboarding"}
          >
            {product ? "Open store" : "Add product"}
          </Link>
        }
      />
      {product ? (
        <ProductRecord brandName={brandName} product={product} />
      ) : (
        <EmptyProduct />
      )}
    </>
  );
}

function ProductRecord(props: {
  brandName: string | undefined;
  product: ProductInput;
}) {
  const { brandName, product } = props;
  const name = resolveProductName(product);
  return (
    <section className="product-record">
      <div className="product-record-image">
        {product.imageUrl ? (
          <Image
            alt={name}
            height={700}
            src={product.imageUrl}
            unoptimized
            width={700}
          />
        ) : (
          <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
        )}
      </div>
      <div>
        <p>Canonical product</p>
        <h2>{name}</h2>
        <p>{product.description}</p>
        <dl>
          <div>
            <dt>Brand</dt>
            <dd>{brandName || "Not provided"}</dd>
          </div>
          <div>
            <dt>Confirmed price</dt>
            <dd>
              {product.price ? `$${product.price.toFixed(2)}` : "Not provided"}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function EmptyProduct() {
  return (
    <div className="empty-panel compact">
      <h2>No product yet</h2>
      <p>Add one product to generate your storefront.</p>
    </div>
  );
}
