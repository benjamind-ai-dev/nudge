import { z } from "zod";

export const authorizeSchema = z.object({
  businessId: z.string().uuid(),
  provider: z.enum(["quickbooks", "xero"]),
});

export type AuthorizeDto = z.infer<typeof authorizeSchema>;
