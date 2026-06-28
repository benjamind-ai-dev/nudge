import { z } from "zod";

export const triggerManualSyncSchema = z
  .object({
    /** Re-pull the full invoice history instead of the incremental delta. */
    full: z.boolean().optional(),
  })
  .strict();
export type TriggerManualSyncDto = z.infer<typeof triggerManualSyncSchema>;
