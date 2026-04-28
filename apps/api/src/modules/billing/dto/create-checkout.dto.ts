import { z } from "zod";

export const createCheckoutSchema = z.object({
  plan: z.enum(["starter", "growth", "agency"]),
});

export type CreateCheckoutDto = z.infer<typeof createCheckoutSchema>;
