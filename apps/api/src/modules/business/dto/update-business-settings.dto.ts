import { z } from "zod";

export const updateBusinessSettingsSchema = z.object({
  senderName: z.string().min(1).optional(),
  senderEmail: z.string().email().optional(),
  emailSignature: z.string().nullable().optional(),
  timezone: z.string().min(1).optional(),
});

export type UpdateBusinessSettingsDto = z.infer<typeof updateBusinessSettingsSchema>;
