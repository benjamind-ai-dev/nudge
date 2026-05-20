import { z } from "zod";

export const businessIdQuerySchema = z.string().uuid();
export type BusinessIdQuery = z.infer<typeof businessIdQuerySchema>;

export const listTiersQuerySchema = z.object({
  businessId: z.string().uuid(),
});
export type ListTiersQuery = z.infer<typeof listTiersQuerySchema>;

export const createTierSchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  description: z.string().max(1000).nullable().optional(),
});
export type CreateTierDto = z.infer<typeof createTierSchema>;

export const updateTierSchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().max(1000).nullable().optional(),
  sequenceId: z.string().uuid().nullable().optional(),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});
export type UpdateTierDto = z.infer<typeof updateTierSchema>;

export const deleteTierQuerySchema = z.object({
  businessId: z.string().uuid(),
});
export type DeleteTierQuery = z.infer<typeof deleteTierQuerySchema>;
