import { apiClient } from "./client";

export type InvoiceStatus =
  | "open"
  | "overdue"
  | "partial"
  | "paid"
  | "voided"
  | "disputed";

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string | null;
  status: InvoiceStatus;
  amountCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
  currency: string;
  daysOverdue: number;
  dueDate: string; // ISO 8601
  issuedDate: string | null;
  paymentLinkUrl: string | null;
  customer: { id: string; companyName: string };
}

export interface InvoicePagination {
  limit: number;
  total: number;
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ListInvoicesParams {
  businessId: string;
  limit?: number;
  cursor?: string;
}

export function listInvoices(
  params: ListInvoicesParams,
): Promise<{ data: InvoiceListItem[]; pagination: InvoicePagination }> {
  const qs = new URLSearchParams({ businessId: params.businessId });
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  if (params.cursor) qs.set("cursor", params.cursor);
  return apiClient(`/v1/invoices?${qs}`);
}
