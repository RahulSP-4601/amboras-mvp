import { z } from "zod";

import { storeConfigSchema } from "@/lib/domain/store-config";
import { createAdminClient } from "@/lib/supabase/admin";

const publicStoreSchema = z.object({
  id: z.string().uuid(),
  current_published_version_id: z.string().uuid().nullable(),
});

const publishedVersionSchema = z.object({ config: z.unknown() });
const publicProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  price: z.union([z.string(), z.number(), z.null()]),
  image_path: z.string().nullable(),
});

export async function getPublicStore(slug: string) {
  const client = createAdminClient();
  const { data: store, error } = await client
    .from("stores")
    .select("id,name,current_published_version_id")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw publicStoreLoadError("store", error);
  if (!store) return null;
  const publishedStore = publicStoreSchema.parse(store);
  if (!publishedStore.current_published_version_id) {
    throw publicStoreLoadError("published version pointer");
  }

  const [versionResult, productResult] = await Promise.all([
    client
      .from("store_versions")
      .select("config")
      .eq("id", publishedStore.current_published_version_id)
      .eq("store_id", publishedStore.id)
      .eq("status", "published")
      .single(),
    client
      .from("products")
      .select("name,description,price,image_path")
      .eq("store_id", publishedStore.id)
      .single(),
  ]);
  if (versionResult.error) {
    throw publicStoreLoadError("published version", versionResult.error);
  }
  if (productResult.error) {
    throw publicStoreLoadError("product", productResult.error);
  }
  const version = publishedVersionSchema.parse(versionResult.data);
  const product = publicProductSchema.parse(productResult.data);

  return {
    storeId: publishedStore.id,
    config: storeConfigSchema.parse(version.config),
    product: {
      name: product.name,
      description: product.description,
      price: product.price === null ? null : Number(product.price),
      imageUrl: product.image_path || undefined,
    },
  };
}

function publicStoreLoadError(step: string, cause?: unknown): Error {
  return new Error(`Unable to load public ${step}.`, { cause });
}
