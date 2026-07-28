import { z } from "zod";

export const eventTypeSchema = z.enum([
  "page_view",
  "product_view",
  "scroll_50",
  "cta_click",
  "checkout_started",
  "conversion_completed",
]);

export const eventRequestSchema = z
  .object({
    eventId: z.string().uuid(),
    eventType: eventTypeSchema,
    metadata: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional(),
  })
  .strict()
  .superRefine((event, context) => {
    if (JSON.stringify(event.metadata ?? {}).length > 2_000) {
      context.addIssue({
        code: "custom",
        message: "Event metadata is too large",
      });
    }
  });

export interface TrackedEvent {
  eventId: string;
  storeId: string;
  visitorId: string;
  sessionId: string;
  eventType: z.infer<typeof eventTypeSchema>;
  createdAt: string;
  synthetic: boolean;
}

export function ingestEvent(
  events: readonly TrackedEvent[],
  candidate: TrackedEvent,
): TrackedEvent[] {
  eventRequestSchema.parse({
    eventId: candidate.eventId,
    eventType: candidate.eventType,
  });
  if (events.some((event) => event.eventId === candidate.eventId))
    return [...events];
  return [...events, candidate];
}
