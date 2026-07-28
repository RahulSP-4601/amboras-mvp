import { z } from "zod";

export const sectionIdSchema = z.enum([
  "announcement",
  "header",
  "hero",
  "product_details",
  "benefits",
  "trust",
  "faq",
  "final_cta",
  "footer",
]);

const textSchema = z.string().trim().min(1).max(500);
const shortTextSchema = z.string().trim().min(1).max(120);

export const storeConfigSchema = z
  .object({
    schemaVersion: z.literal("1"),
    productId: z.string().uuid(),
    brandName: shortTextSchema,
    tagline: shortTextSchema,
    heroHeadline: shortTextSchema,
    heroSupportingText: textSchema,
    ctaText: z.string().trim().min(1).max(40),
    offerText: z.string().trim().max(160),
    benefits: z.array(shortTextSchema).min(3).max(6),
    trustMessages: z.array(shortTextSchema).max(4),
    faq: z
      .array(
        z.object({ question: shortTextSchema, answer: textSchema }).strict(),
      )
      .max(5),
    colors: z
      .object({
        background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        foreground: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        surface: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      })
      .strict(),
    typography: z.enum(["modern", "editorial", "minimal"]),
    enabledSections: z.array(sectionIdSchema).min(4),
    sectionOrder: z.array(sectionIdSchema).min(4),
  })
  .strict()
  .superRefine((config, context) => {
    const enabled = new Set(config.enabledSections);
    const order = new Set(config.sectionOrder);
    if (enabled.size !== config.enabledSections.length) {
      context.addIssue({
        code: "custom",
        message: "Enabled sections contain duplicates",
      });
    }
    if (order.size !== config.sectionOrder.length) {
      context.addIssue({
        code: "custom",
        message: "Section order contains duplicates",
      });
    }
    for (const section of config.enabledSections) {
      if (!order.has(section)) {
        context.addIssue({
          code: "custom",
          message: `Missing section: ${section}`,
        });
      }
    }
  });

export type StoreConfig = z.infer<typeof storeConfigSchema>;
