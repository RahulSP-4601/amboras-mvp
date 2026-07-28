import { z } from "zod";

export const productInputSchema = z
  .object({
    description: z.string().trim().min(20).max(2_500),
    name: z.string().trim().max(120).optional(),
    price: z.coerce.number().positive().max(1_000_000).optional(),
    brandName: z.string().trim().max(120).optional(),
    imageUrl: z.string().url().max(2_000).optional(),
  })
  .strict();

export const productSchema = productInputSchema.extend({
  id: z.string().uuid(),
  storeId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  price: z.number().positive().max(1_000_000).nullable(),
});

export type ProductInput = z.infer<typeof productInputSchema>;
export type Product = z.infer<typeof productSchema>;

export function resolveProductName(input: ProductInput): string {
  if (input.name) return input.name;
  const words = input.description
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);
  const inferred = words.map(titleCaseWord).join(" ");
  return truncateProductName(inferred || "Featured Product");
}

function titleCaseWord(word: string) {
  const [first = "", ...rest] = Array.from(word);
  return `${first.toLocaleUpperCase()}${rest.join("")}`;
}

function truncateProductName(value: string) {
  return Array.from(value).slice(0, 120).join("").trim();
}
