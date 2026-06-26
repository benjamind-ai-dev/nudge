import { apiClient } from "./client";

export interface RelationshipTierSummary {
  id: string;
  name: string;
}

export interface CustomerListItem {
  id: string;
  businessId: string;
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  relationshipTier: RelationshipTierSummary | null;
  sequenceId: string | null;
  paymentTerms: string | null;
  avgDaysToPay: number | null;
  totalOutstanding: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerListPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface GetCustomersParams {
  businessId: string;
  search?: string;
  hasOverdue?: boolean;
  limit?: number;
  page?: number;
}

export function getCustomers(
  params: GetCustomersParams,
): Promise<{ data: CustomerListItem[]; pagination: CustomerListPagination }> {
  const qs = new URLSearchParams({ businessId: params.businessId });
  if (params.search) qs.set("search", params.search);
  if (params.hasOverdue) qs.set("hasOverdue", "true");
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  if (params.page !== undefined) qs.set("page", String(params.page));
  return apiClient(`/v1/customers?${qs.toString()}`);
}
