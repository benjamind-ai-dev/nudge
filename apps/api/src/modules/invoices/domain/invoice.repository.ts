import type { Invoice } from "./invoice.entity";

export const INVOICE_REPOSITORY = Symbol("InvoiceRepository");

export interface InvoiceRepository {
  findAllByBusiness(businessId: string): Promise<Invoice[]>;
}
