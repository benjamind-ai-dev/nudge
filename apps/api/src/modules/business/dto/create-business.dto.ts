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

export const createBusinessSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().min(1),
  accountingProvider: z.enum(["quickbooks", "xero"]),
  senderName: z.string().min(1),
  senderEmail: z.string().email(),
  timezone: ianaTimezone,
  emailSignature: z.string().optional(),
});

export type CreateBusinessDto = z.infer<typeof createBusinessSchema>;
