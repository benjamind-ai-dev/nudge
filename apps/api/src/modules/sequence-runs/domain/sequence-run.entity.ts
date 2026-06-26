export type SequenceRunStatus = "active" | "paused" | "stopped" | "completed";

export type StepChannel = "email" | "sms" | "email_and_sms";

export interface SequenceRunListItem {
  id: string;
  status: SequenceRunStatus;
  pausedReason: string | null;
  stoppedReason: string | null;
  nextSendAt: Date | null;
  startedAt: Date;
  completedAt: Date | null;
  invoice: {
    id: string;
    invoiceNumber: string | null;
    amountCents: number;
    balanceDueCents: number;
    status: string;
  };
  customer: {
    id: string;
    companyName: string;
  };
  currentStep: {
    stepOrder: number;
    channel: StepChannel;
  } | null;
}

export interface SequenceStepDetail {
  id: string;
  stepOrder: number;
  delayDays: number;
  channel: StepChannel;
  state: "completed" | "current" | "upcoming";
}

export interface SequenceRunMessageDetail {
  id: string;
  channel: "email" | "sms";
  subject: string | null;
  status: string;
  sentAt: Date | null;
  openedAt: Date | null;
  clickedAt: Date | null;
  repliedAt: Date | null;
  // 100-char snippet of the reply body, trimmed, or null if no reply.
  replyBody: string | null;
}

export interface SequenceRunDetail {
  id: string;
  status: SequenceRunStatus;
  pausedReason: string | null;
  stoppedReason: string | null;
  nextSendAt: Date | null;
  startedAt: Date;
  completedAt: Date | null;
  invoice: {
    id: string;
    invoiceNumber: string | null;
    amountCents: number;
    amountPaidCents: number;
    balanceDueCents: number;
    currency: string;
    dueDate: Date;
    status: string;
  };
  customer: {
    id: string;
    companyName: string;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
  };
  sequence: {
    id: string;
    name: string;
    tierName: string | null;
  };
  steps: SequenceStepDetail[];
  messages: SequenceRunMessageDetail[];
}
