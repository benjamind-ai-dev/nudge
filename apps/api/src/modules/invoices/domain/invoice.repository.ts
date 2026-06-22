import type {
  InvoiceDetail,
  InvoiceListItem,
  InvoiceSortField,
  InvoiceSortOrder,
  InvoiceStatus,
} from "./invoice.entity";

export const INVOICE_REPOSITORY = Symbol("InvoiceRepository");

export interface InvoiceListFilter {
  businessId: string;
  limit: number;
  /** Invoice id to page after (keyset cursor). Omitted for the first page. */
  cursor?: string;
  status?: InvoiceStatus;
  customerId?: string;
  minAmount?: number;
  maxAmount?: number;
  dueBefore?: Date;
  dueAfter?: Date;
  sortBy: InvoiceSortField;
  sortOrder: InvoiceSortOrder;
}

export interface InvoiceListResult {
  items: InvoiceListItem[];
  total: number;
  /** Cursor for the next page, or null when there are no more rows. */
  nextCursor: string | null;
}

// Minimal shape needed by CreatePaymentLinkUseCase to decide whether to skip
// the Stripe call (existing URL), throw (paid/voided), or proceed.
export interface InvoicePaymentLinkContext {
  id: string;
  invoiceNumber: string | null;
  status: InvoiceStatus;
  balanceDueCents: number;
  paymentLinkUrl: string | null;
  customer: {
    companyName: string;
  };
}

export interface InvoiceRepository {
  findManyByFilter(filter: InvoiceListFilter): Promise<InvoiceListResult>;
  findDetailById(id: string, businessId: string): Promise<InvoiceDetail | null>;
  findForPaymentLink(
    id: string,
    businessId: string,
  ): Promise<InvoicePaymentLinkContext | null>;
  updatePaymentLinkUrl(
    id: string,
    businessId: string,
    paymentLinkUrl: string,
  ): Promise<void>;
}
