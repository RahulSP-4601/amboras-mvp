import "server-only";

import OpenAI from "openai";
import { z } from "zod";

import {
  applyStoreEditProposal,
  storeEditProposalSchema,
  type StoreEditProposal,
} from "@/lib/domain/store-edit";
import { storeConfigSchema, type StoreConfig } from "@/lib/domain/store-config";
import { getOpenAiApiKey } from "@/lib/env";

const proposalResultSchema = z.object({
  proposal: storeEditProposalSchema,
});

export async function proposeStoreEdit(
  configValue: unknown,
  instructionValue: unknown,
): Promise<StoreEditProposal> {
  const config = storeConfigSchema.parse(configValue);
  const instruction = z.string().trim().min(3).max(500).parse(instructionValue);
  const apiKey = getOpenAiApiKey();
  if (!apiKey && process.env.NODE_ENV === "production") {
    throw new Error("AI store editing is not configured");
  }
  const proposal = apiKey
    ? await requestProposal(config, instruction, apiKey)
    : localProposal(config, instruction);
  applyStoreEditProposal(config, proposal);
  return proposal;
}

async function requestProposal(
  config: StoreConfig,
  instruction: string,
  apiKey: string,
): Promise<StoreEditProposal> {
  const client = new OpenAI({ apiKey, timeout: 30_000, maxRetries: 2 });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    store: false,
    input: buildPrompt(config, instruction),
    text: {
      format: {
        type: "json_schema",
        name: "store_edit_proposal",
        strict: true,
        schema: z.toJSONSchema(proposalResultSchema),
      },
    },
  });
  const result = proposalResultSchema.parse(JSON.parse(response.output_text));
  return result.proposal;
}

function buildPrompt(config: StoreConfig, instruction: string): string {
  return [
    "Propose a truthful, controlled storefront edit.",
    "Only change heroHeadline, heroSupportingText, or ctaText.",
    "Never invent evidence, reviews, guarantees, or product facts.",
    "Return presentation data only and no executable content.",
    `Merchant instruction: ${instruction}`,
    `Current StoreConfig: ${JSON.stringify(config)}`,
  ].join("\n");
}

function localProposal(
  config: StoreConfig,
  instruction: string,
): StoreEditProposal {
  const lower = instruction.toLowerCase();
  if (lower.includes("button") || lower.includes("cta")) {
    return proposal(
      "Clarify the primary action",
      "A specific action makes the next step easier to understand.",
      "ctaText",
      `Discover ${config.brandName}`.slice(0, 40),
    );
  }
  if (lower.includes("support") || lower.includes("detail")) {
    return proposal(
      "Strengthen the supporting message",
      "The supporting copy can connect the product to everyday use.",
      "heroSupportingText",
      `${config.heroSupportingText} ${config.tagline}.`.slice(0, 500),
    );
  }
  return proposal(
    "Sharpen the hero headline",
    "A more direct headline can make the product focus clearer.",
    "heroHeadline",
    `${config.brandName}, thoughtfully made for every day.`.slice(0, 120),
  );
}

function proposal(
  summary: string,
  rationale: string,
  field: "heroHeadline" | "heroSupportingText" | "ctaText",
  value: string,
): StoreEditProposal {
  return storeEditProposalSchema.parse({
    summary,
    rationale,
    changes: [{ field, value }],
  });
}
