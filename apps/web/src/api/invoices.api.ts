import { apiClient } from "./client";

export type InvoiceStatus =
  | "open"
  | "overdue"
  | "partial"
  | "paid"
  | "voided"
  | "disputed";

export interface InvoiceSequenceRun {
  id: string;
  status: string;
}

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
  sequenceRun: InvoiceSequenceRun | null;
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
  status?: InvoiceStatus;
  sortBy?: "amount_cents" | "due_date" | "days_overdue" | "customer_name";
  sortOrder?: "asc" | "desc";
}

export interface StartFollowUpResult {
  runId: string | null;
  created: boolean;
  status: "active" | "already_running";
}

export function listInvoices(
  params: ListInvoicesParams,
): Promise<{ data: InvoiceListItem[]; pagination: InvoicePagination }> {
  const qs = new URLSearchParams({ businessId: params.businessId });
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  if (params.cursor) qs.set("cursor", params.cursor);
  if (params.status) qs.set("status", params.status);
  if (params.sortBy) qs.set("sortBy", params.sortBy);
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder);
  return apiClient(`/v1/invoices?${qs}`);
}

export function startFollowUp(
  invoiceId: string,
  businessId: string,
): Promise<{ data: StartFollowUpResult }> {
  return apiClient(`/v1/invoices/${invoiceId}/start-follow-up?businessId=${businessId}`, {
    method: "POST",
  });
}
