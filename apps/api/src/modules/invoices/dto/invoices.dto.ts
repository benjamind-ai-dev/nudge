import { z } from "zod";

const invoiceStatusEnum = z.enum([
  "open",
  "overdue",
  "partial",
  "paid",
  "voided",
  "disputed",
]);

const sortByEnum = z.enum([
  "due_date",
  "amount_cents",
  "days_overdue",
  "status",
  "paid_at",
]);

const sortOrderEnum = z.enum(["asc", "desc"]);

export const listInvoicesQuerySchema = z
  .object({
    businessId: z.string().uuid(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(25),
    status: invoiceStatusEnum.optional(),
    customerId: z.string().uuid().optional(),
    minAmount: z.coerce.number().int().nonnegative().optional(),
    maxAmount: z.coerce.number().int().nonnegative().optional(),
    dueBefore: z.coerce.date().optional(),
    dueAfter: z.coerce.date().optional(),
    sortBy: sortByEnum.default("due_date"),
    sortOrder: sortOrderEnum.default("desc"),
  })
  .refine(
    (q) =>
      q.minAmount === undefined ||
      q.maxAmount === undefined ||
      q.minAmount <= q.maxAmount,
    { message: "minAmount must be <= maxAmount", path: ["minAmount"] },
  )
  .refine(
    (q) =>
      q.dueAfter === undefined ||
      q.dueBefore === undefined ||
      q.dueAfter <= q.dueBefore,
    { message: "dueAfter must be <= dueBefore", path: ["dueAfter"] },
  );
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;

export const getInvoiceQuerySchema = z.object({
  businessId: z.string().uuid(),
});
export type GetInvoiceQuery = z.infer<typeof getInvoiceQuerySchema>;

export const createPaymentLinkQuerySchema = z.object({
  businessId: z.string().uuid(),
});
export type CreatePaymentLinkQuery = z.infer<
  typeof createPaymentLinkQuerySchema
>;
