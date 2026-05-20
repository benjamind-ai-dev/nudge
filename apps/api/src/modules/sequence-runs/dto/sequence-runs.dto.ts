import { z } from "zod";

export const listSequenceRunsQuerySchema = z.object({
  businessId: z.string().uuid(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  status: z.enum(["active", "paused", "stopped", "completed"]).optional(),
  customerId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
});
export type ListSequenceRunsQuery = z.infer<typeof listSequenceRunsQuerySchema>;

export const getSequenceRunQuerySchema = z.object({
  businessId: z.string().uuid(),
});
export type GetSequenceRunQuery = z.infer<typeof getSequenceRunQuerySchema>;

export const actionQuerySchema = z.object({
  businessId: z.string().uuid(),
});
export type ActionQuery = z.infer<typeof actionQuerySchema>;

export const pauseBodySchema = z.object({
  reason: z.literal("manual_pause"),
});
export type PauseBody = z.infer<typeof pauseBodySchema>;

export const stopBodySchema = z.object({
  reason: z.literal("manual_stop"),
});
export type StopBody = z.infer<typeof stopBodySchema>;
