import { apiClient } from "./client";

export type SequenceRunStatus = "active" | "paused" | "stopped" | "completed";

export type StepChannel = "email" | "sms" | "email_and_sms";

export interface SequenceRunListItem {
  id: string;
  status: SequenceRunStatus;
  pausedReason: string | null;
  stoppedReason: string | null;
  nextSendAt: string | null;
  startedAt: string;
  completedAt: string | null;
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

export interface ListSequenceRunsParams {
  businessId: string;
  sequenceId?: string;
  status?: SequenceRunStatus;
  customerId?: string;
  invoiceId?: string;
  limit?: number;
  page?: number;
}

export function listSequenceRuns(params: ListSequenceRunsParams): Promise<{
  data: SequenceRunListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  });
  return apiClient(`/v1/sequence-runs?${qs}`);
}

export function stopSequenceRun(
  id: string,
  businessId: string,
): Promise<{ data: SequenceRunListItem }> {
  return apiClient(`/v1/sequence-runs/${id}/stop?businessId=${businessId}`, {
    method: "POST",
    body: JSON.stringify({ reason: "manual_stop" }),
  });
}
