export interface RelationshipTierSummary {
  id: string;
  name: string;
}

export type CustomerListSortField =
  | "company_name"
  | "total_outstanding"
  | "avg_days_to_pay";

export type CustomerListSortOrder = "asc" | "desc";

export interface Customer {
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
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerRecentInvoice {
  id: string;
  invoiceNumber: string | null;
  status: string;
  amountCents: number;
  balanceDueCents: number;
  dueDate: Date;
  daysOverdue: number;
}

export interface CustomerDetail extends Customer {
  recentInvoices: CustomerRecentInvoice[];
  activeSequenceRunCount: number;
  lastMessageSentAt: Date | null;
}
