import { z } from "zod";

export const triggerWeeklySummarySchema = z.object({
  businessId: z.string().uuid(),
  weekStartsAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "weekStartsAt must be YYYY-MM-DD")
    .optional(),
});

export type TriggerWeeklySummaryDto = z.infer<typeof triggerWeeklySummarySchema>;
