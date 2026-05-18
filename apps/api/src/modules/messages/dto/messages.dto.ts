import { z } from "zod";

export const listMessagesQuerySchema = z.object({
  businessId: z.string().uuid(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  customerId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  sequenceRunId: z.string().uuid().optional(),
  channel: z.enum(["email", "sms"]).optional(),
  status: z.enum(["queued", "sent", "delivered", "bounced", "failed"]).optional(),
  hasReply: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((v) => (typeof v === "boolean" ? v : v === "true"))
    .optional(),
  sentAfter: z.coerce.date().optional(),
  sentBefore: z.coerce.date().optional(),
});
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;

export const getMessageQuerySchema = z.object({
  businessId: z.string().uuid(),
});
export type GetMessageQuery = z.infer<typeof getMessageQuerySchema>;

export const sendReplyBodySchema = z.object({
  body: z.string().trim().min(1, "Reply body must not be empty"),
  resumeSequence: z.boolean(),
});
export type SendReplyBody = z.infer<typeof sendReplyBodySchema>;
