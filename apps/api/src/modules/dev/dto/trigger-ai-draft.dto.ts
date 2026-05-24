import { z } from "zod";

export const triggerAiDraftSchema = z.object({
  replyBody: z.string().min(1),
});

export type TriggerAiDraftDto = z.infer<typeof triggerAiDraftSchema>;
