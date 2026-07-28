import { randomUUID } from "node:crypto";

import { resolveProductName, type ProductInput } from "@/lib/domain/product";
import { storeConfigSchema, type StoreConfig } from "@/lib/domain/store-config";

export function createDeterministicDraft(input: ProductInput): StoreConfig {
  const productName = resolveProductName(input);
  const brandName =
    input.brandName || boundedText(`${productName} Studio`, 120);
  const draft = {
    schemaVersion: "1",
    productId: randomUUID(),
    brandName,
    tagline: boundedText(`Designed around ${productName.toLowerCase()}`, 120),
    heroHeadline: boundedText(`${productName}, made to feel considered.`, 120),
    heroSupportingText: trimDescription(input.description),
    ctaText: "Explore the product",
    offerText: input.price
      ? `Available for $${input.price.toFixed(2)}`
      : "Discover the details",
    benefits: buildBenefits(input.description),
    trustMessages: [
      "Thoughtful product design",
      "Clear, honest product information",
    ],
    faq: [
      {
        question: boundedText(`What makes ${productName} different?`, 120),
        answer: trimDescription(input.description),
      },
    ],
    colors: defaultColors(),
    typography: "editorial",
    enabledSections: [
      "header",
      "hero",
      "product_details",
      "benefits",
      "trust",
      "faq",
      "footer",
    ],
    sectionOrder: [
      "header",
      "hero",
      "product_details",
      "benefits",
      "trust",
      "faq",
      "footer",
    ],
  };
  return storeConfigSchema.parse(draft);
}

function defaultColors() {
  return {
    background: "#f4f1eb" as const,
    foreground: "#171513" as const,
    accent: "#7b2935" as const,
    surface: "#ffffff" as const,
  };
}

function trimDescription(description: string): string {
  const trimmed = description.trim();
  return trimmed.length <= 220 ? trimmed : `${boundedText(trimmed, 217)}...`;
}

function boundedText(value: string, maxLength: number): string {
  let result = "";
  for (const character of value) {
    if (`${result}${character}`.length > maxLength) break;
    result += character;
  }
  return result.trim();
}

function buildBenefits(description: string): string[] {
  const lower = description.toLowerCase();
  const candidates = [
    lower.includes("premium") ? "Premium materials" : "Purposeful construction",
    lower.includes("sustainable")
      ? "Responsibly considered"
      : "Designed for daily use",
    lower.includes("light") ? "Lightweight comfort" : "Built around real needs",
  ];
  return candidates;
}
