import { z } from "zod";

import { productSchema } from "@/lib/domain/product";
import { storeConfigSchema } from "@/lib/domain/store-config";
import {
  storeVersionSummarySchema,
  type StoreWorkspace,
} from "@/lib/domain/store-workspace";
import { createClient } from "@/lib/supabase/server";

const storedVersionSchema = z.object({
  id: z.string().uuid(),
  version_number: z.number().int().positive(),
  status: z.enum(["draft", "published", "archived"]),
  source: z.enum([
    "ai_generation",
    "manual_edit",
    "ai_edit",
    "rollback",
    "experiment",
  ]),
  parent_version_id: z.string().uuid().nullable(),
  created_at: z.string().datetime({ offset: true }),
  config: z.unknown(),
});

const storeIdentitySchema = z.object({
  name: z.string().trim().min(1),
});

const ownedStoreSchema = z.object({
  id: z.string().uuid(),
  current_draft_version_id: z.string().uuid().nullable(),
  current_published_version_id: z.string().uuid().nullable(),
  slug: z.string().min(1),
});

const storedProductSchema = z.object({
  id: z.string().uuid(),
  store_id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  price: z.union([z.string(), z.number(), z.null()]),
  image_path: z.string().nullable(),
});

export async function getOwnedStoreName(): Promise<string | null> {
  const client = await createClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw workspaceLoadError("authentication", authError);
  if (!auth.user) return null;

  const { data: store, error: storeError } = await client
    .from("stores")
    .select("name")
    .eq("owner_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (storeError) throw workspaceLoadError("store identity", storeError);
  return store ? storeIdentitySchema.parse(store).name : null;
}

export async function getOwnedStoreWorkspace(): Promise<StoreWorkspace | null> {
  const client = await createClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw workspaceLoadError("authentication", authError);
  if (!auth.user) return null;

  const { data: store, error: storeError } = await client
    .from("stores")
    .select("id,current_draft_version_id,current_published_version_id,slug")
    .eq("owner_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (storeError) throw workspaceLoadError("store", storeError);
  if (!store) return null;
  const ownedStore = ownedStoreSchema.parse(store);

  const [versionsResult, productResult] = await Promise.all([
    client
      .from("store_versions")
      .select(
        "id,version_number,status,source,parent_version_id,created_at,config",
      )
      .eq("store_id", ownedStore.id)
      .order("version_number", { ascending: false }),
    client.from("products").select("*").eq("store_id", ownedStore.id).single(),
  ]);
  if (versionsResult.error) {
    throw workspaceLoadError("store versions", versionsResult.error);
  }
  if (productResult.error) {
    throw workspaceLoadError("product", productResult.error);
  }
  return buildWorkspace(ownedStore, versionsResult.data, productResult.data);
}

function buildWorkspace(
  store: z.infer<typeof ownedStoreSchema>,
  versionData: unknown,
  productData: unknown,
): StoreWorkspace {
  const versions = z.array(storedVersionSchema).parse(versionData);
  const currentId =
    store.current_draft_version_id || store.current_published_version_id;
  const current = versions.find((version) => version.id === currentId);
  if (!current) {
    throw workspaceLoadError("current store version");
  }
  const publishedId = store.current_published_version_id;
  const published = versions.find((version) => version.id === publishedId);
  const product = productSchema.parse(toProduct(productData));
  return {
    draft: {
      config: storeConfigSchema.parse(current.config),
      product: { ...product, price: product.price ?? undefined },
      generatedAt: current.created_at,
      persisted: {
        storeId: store.id,
        versionId: current.id,
        slug: store.slug,
      },
    },
    publishedConfig: published
      ? storeConfigSchema.parse(published.config)
      : null,
    versions: versions.map(toVersionSummary),
  };
}

function toVersionSummary(value: z.infer<typeof storedVersionSchema>) {
  return storeVersionSummarySchema.parse({
    id: value.id,
    versionNumber: value.version_number,
    status: value.status,
    source: value.source,
    parentVersionId: value.parent_version_id,
    createdAt: value.created_at,
  });
}

function toProduct(value: unknown) {
  const product = storedProductSchema.parse(value);
  return {
    id: product.id,
    storeId: product.store_id,
    name: product.name,
    description: product.description,
    price: product.price === null ? null : Number(product.price),
    imageUrl: product.image_path || undefined,
  };
}

function workspaceLoadError(step: string, cause?: unknown): Error {
  return new Error(`Unable to load ${step}.`, { cause });
}
