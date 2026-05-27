import { z } from "zod";

export const dashboardSummaryQuerySchema = z.object({
  businessId: z.string().uuid(),
});
export type DashboardSummaryQuery = z.infer<typeof dashboardSummaryQuerySchema>;
