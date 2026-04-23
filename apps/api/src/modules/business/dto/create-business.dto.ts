import { z } from "zod";

export const createBusinessSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().min(1),
  accountingProvider: z.enum(["quickbooks", "xero"]),
  senderName: z.string().min(1),
  senderEmail: z.string().email(),
  timezone: z.string().min(1),
  emailSignature: z.string().optional(),
});

export type CreateBusinessDto = z.infer<typeof createBusinessSchema>;
