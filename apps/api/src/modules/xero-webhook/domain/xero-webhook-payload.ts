import { z } from "zod";

export const xeroEventSchema = z.object({
  resourceUrl: z.string().url(),
  resourceId: z.string().min(1),
  tenantId: z.string().min(1),
  eventCategory: z.string().min(1),
  eventType: z.string().min(1),
  eventDateUtc: z.string().optional(),
});

export type XeroEvent = z.infer<typeof xeroEventSchema>;

export const xeroWebhookPayloadSchema = z.object({
  events: z.array(xeroEventSchema),
  firstEventSequence: z.number(),
  lastEventSequence: z.number(),
});

export type XeroWebhookPayload = z.infer<typeof xeroWebhookPayloadSchema>;
