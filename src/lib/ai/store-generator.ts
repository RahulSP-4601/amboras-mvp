import OpenAI from "openai";
import { z } from "zod";

import { createDeterministicDraft } from "@/lib/domain/generation";
import { productInputSchema, type ProductInput } from "@/lib/domain/product";
import { storeConfigSchema, type StoreConfig } from "@/lib/domain/store-config";
import { getOpenAiApiKey } from "@/lib/env";

const generationResultSchema = z.object({
  config: storeConfigSchema,
});

export interface GenerationResult {
  config: StoreConfig;
  mode: "openai" | "local_preview";
}

export async function generateStore(input: unknown): Promise<GenerationResult> {
  const product = productInputSchema.parse(input);
  const apiKey = getOpenAiApiKey();

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Store generation is not configured");
    }
    return { config: createDeterministicDraft(product), mode: "local_preview" };
  }

  const config = await requestStructuredStore(product, apiKey);
  return { config, mode: "openai" };
}

async function requestStructuredStore(
  product: ProductInput,
  apiKey: string,
): Promise<StoreConfig> {
  const client = new OpenAI({ apiKey, timeout: 30_000, maxRetries: 2 });
  const draft = createDeterministicDraft(product);
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    store: false,
    input: buildPrompt(product, draft.productId),
    text: {
      format: {
        type: "json_schema",
        name: "store_generation_result",
        strict: true,
        schema: z.toJSONSchema(generationResultSchema),
      },
    },
  });

  return generationResultSchema.parse(JSON.parse(response.output_text)).config;
}

function buildPrompt(product: ProductInput, productId: string): string {
  return [
    "Create a truthful one-product StoreConfig.",
    "Never invent reviews, ratings, certifications, guarantees, or performance claims.",
    "Return presentation data only—never code, HTML, CSS, SQL, or executable content.",
    `The canonical product ID is ${productId}.`,
    `Product input: ${JSON.stringify(product)}`,
  ].join("\n");
}
