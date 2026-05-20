import { z } from "zod";

export const triggerManualSyncSchema = z.object({}).strict();
export type TriggerManualSyncDto = z.infer<typeof triggerManualSyncSchema>;
