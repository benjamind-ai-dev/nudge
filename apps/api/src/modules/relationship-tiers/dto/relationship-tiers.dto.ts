import { z } from "zod";

export const businessIdQuerySchema = z.string().uuid();
export type BusinessIdQuery = z.infer<typeof businessIdQuerySchema>;

export const updateTierSchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  sequenceId: z.string().uuid().nullable().optional(),
});
export type UpdateTierDto = z.infer<typeof updateTierSchema>;
