import { generationResponseSchema } from "@/lib/domain/generation-result";
import { productInputSchema, resolveProductName } from "@/lib/domain/product";
import type { StoreConfig } from "@/lib/domain/store-config";
import type { GenerationJob } from "@/lib/ai/generation-jobs";
import { z } from "zod";

const rpcResponseSchema = z.object({
  data: z.unknown(),
  error: z.unknown().nullable(),
});

export async function persistGeneratedStore(
  job: GenerationJob,
  input: unknown,
  config: StoreConfig,
  mode: "openai" | "local_preview",
) {
  const product = productInputSchema.parse(input);
  const slug = createSlug(config.brandName, job.id);
  const rpcResponse: unknown = await job.client.rpc("persist_generated_store", {
    target_user_id: job.userId,
    target_job_id: job.id,
    expected_attempt_count: job.attemptCount,
    expected_started_at: job.startedAt,
    target_store_name: config.brandName,
    target_slug: slug,
    target_product_id: config.productId,
    target_product_name: resolveProductName(product),
    target_product_description: product.description,
    target_product_price: product.price ?? null,
    target_product_image_path: product.imageUrl ?? null,
    store_config: config,
    generation_mode: mode,
  });
  const result = rpcResponseSchema.parse(rpcResponse);
  if (result.error) throw new Error("Generated store transaction failed");
  return generationResponseSchema.parse(result.data);
}

function createSlug(name: string, suffix: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "store"}-${suffix.replaceAll("-", "")}`;
}
