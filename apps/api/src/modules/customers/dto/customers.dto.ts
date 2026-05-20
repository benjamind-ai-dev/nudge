import { z } from "zod";

export const businessIdQuerySchema = z.string().uuid();
export type BusinessIdQuery = z.infer<typeof businessIdQuerySchema>;

const sortByEnum = z.enum(["company_name", "total_outstanding", "avg_days_to_pay"]);
const sortOrderEnum = z.enum(["asc", "desc"]);

const booleanFlagSchema = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((v) => v === true || v === "true");

export const listCustomersQuerySchema = z.object({
  businessId: z.string().uuid(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().trim().min(1).max(100).optional(),
  tierId: z.string().uuid().optional(),
  hasOverdue: booleanFlagSchema.optional(),
  includeInactive: booleanFlagSchema.default(false),
  sortBy: sortByEnum.default("company_name"),
  sortOrder: sortOrderEnum.default("asc"),
});
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;

export const getCustomerQuerySchema = z.object({
  businessId: z.string().uuid(),
});
export type GetCustomerQuery = z.infer<typeof getCustomerQuerySchema>;

export const updateCustomerSchema = z.object({
  businessId: z.string().uuid(),
  relationshipTierId: z.string().uuid().nullable().optional(),
  sequenceId: z.string().uuid().nullable().optional(),
});
export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;

export const assignTierBodySchema = z.object({
  businessId: z.string().uuid(),
  tierId: z.string().uuid().nullable(),
});
export type AssignTierDto = z.infer<typeof assignTierBodySchema>;
