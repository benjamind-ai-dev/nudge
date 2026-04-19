import { z } from "zod";

export const authorizeSchema = z.object({
  businessId: z.string().uuid(),
});

export type AuthorizeDto = z.infer<typeof authorizeSchema>;
