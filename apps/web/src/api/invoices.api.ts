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
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type InvoiceSortBy = "due_date" | "amount_cents" | "days_overdue";
export type SortOrder = "asc" | "desc";

export interface ListInvoicesParams {
  businessId: string;
  page?: number;
  limit?: number;
  status?: InvoiceStatus;
  customerId?: string;
  dueBefore?: string; // ISO date (yyyy-mm-dd)
  dueAfter?: string; // ISO date (yyyy-mm-dd)
  sortBy?: InvoiceSortBy;
  sortOrder?: SortOrder;
}

export function listInvoices(
  params: ListInvoicesParams,
): Promise<{ data: InvoiceListItem[]; pagination: InvoicePagination }> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  });
  return apiClient(`/v1/invoices?${qs}`);
}
