export type InvoiceStatus =
  | "open"
  | "overdue"
  | "partial"
  | "paid"
  | "voided"
  | "disputed";

export type InvoiceSortField =
  | "due_date"
  | "amount_cents"
  | "days_overdue"
  | "status";

export type InvoiceSortOrder = "asc" | "desc";

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string | null;
  status: InvoiceStatus;
  amountCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
  currency: string;
  daysOverdue: number;
  dueDate: Date;
  issuedDate: Date | null;
  paymentLinkUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  customer: {
    id: string;
    companyName: string;
  };
  sequenceRun: InvoiceSequenceRunSummary | null;
}

export interface InvoiceSequenceRunSummary {
  id: string;
  status: "active" | "paused";
  nextSendAt: Date | null;
  currentStep: {
    stepOrder: number;
    // The detail endpoint also returns `name`. The list response only needs
    // step_order + (best-available human label). We expose `name` here too so
    // the list and detail shapes are unified; mapper falls back to a
    // formatted "Step {N}" when no template subject is available.
    name: string;
  } | null;
}

export interface InvoiceSequenceStepDetail {
  id: string;
  stepOrder: number;
  delayDays: number;
  channel: "email" | "sms" | "email_and_sms";
  name: string;
  state: "completed" | "current" | "upcoming";
}

export interface InvoiceMessageDetail {
  id: string;
  channel: "email" | "sms";
  subject: string | null;
  status: string;
  sentAt: Date | null;
  openedAt: Date | null;
  clickedAt: Date | null;
  repliedAt: Date | null;
  replyBody: string | null;
  aiDraftResponse: string | null;
}

export interface InvoiceDetail {
  id: string;
  invoiceNumber: string | null;
  status: InvoiceStatus;
  amountCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
  currency: string;
  daysOverdue: number;
  dueDate: Date;
  issuedDate: Date | null;
  paidAt: Date | null;
  paymentLinkUrl: string | null;
  aiPaymentScore: number | null;
  aiScoreReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  customer: {
    id: string;
    companyName: string;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    paymentTerms: string | null;
  };
  sequenceRun: {
    id: string;
    status: "active" | "paused" | "stopped" | "completed";
    pausedReason: string | null;
    stoppedReason: string | null;
    nextSendAt: Date | null;
    startedAt: Date;
    completedAt: Date | null;
    sequence: {
      id: string;
      name: string;
    };
    steps: InvoiceSequenceStepDetail[];
  } | null;
  messages: InvoiceMessageDetail[];
}
