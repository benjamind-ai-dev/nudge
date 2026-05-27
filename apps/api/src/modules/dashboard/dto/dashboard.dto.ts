import { z } from "zod";

export const dashboardSummaryQuerySchema = z.object({
  businessId: z.string().uuid(),
});
export type DashboardSummaryQuery = z.infer<typeof dashboardSummaryQuerySchema>;

export const needsAttentionQuerySchema = z.object({
  businessId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});
export type NeedsAttentionQuery = z.infer<typeof needsAttentionQuerySchema>;
