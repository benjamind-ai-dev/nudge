import { z } from "zod";

export const businessIdQuerySchema = z.string().uuid();
export type BusinessIdQuery = z.infer<typeof businessIdQuerySchema>;

export const updateCustomerSchema = z.object({
  businessId: z.string().uuid(),
  relationshipTierId: z.string().uuid().nullable().optional(),
  sequenceId: z.string().uuid().nullable().optional(),
});
export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;
