import { z } from "zod";

const ianaTimezone = z.string().refine(
  (tz) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: "Invalid IANA timezone string" },
);

export const updateBusinessSettingsSchema = z.object({
  name: z.string().min(1).optional(),
  senderName: z.string().min(1).optional(),
  senderEmail: z.string().email().optional(),
  emailSignature: z.string().nullable().optional(),
  timezone: ianaTimezone.optional(),
});

export type UpdateBusinessSettingsDto = z.infer<typeof updateBusinessSettingsSchema>;
