import { apiClient } from "./client";

export interface SequenceSummary {
  id: string;
  businessId: string;
  name: string;
  isActive: boolean;
  stepCount: number;
  activeRuns: number;
  relationshipTier: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  inUse: boolean;
  inUseReason: "running" | "assigned" | "history" | null;
}

export function getSequences(businessId: string): Promise<{ data: SequenceSummary[] }> {
  return apiClient(`/v1/sequences?businessId=${businessId}`);
}

export function deleteSequence(id: string, businessId: string): Promise<void> {
  return apiClient(`/v1/sequences/${id}?businessId=${businessId}`, { method: "DELETE" });
}

export type CreateSequenceStep = {
  templateId?: string | null;
  stepOrder: number;
  delayDays: number;
  channel: "email" | "sms" | "email_and_sms";
  subjectTemplate?: string | null;
  bodyTemplate: string;
  smsBodyTemplate?: string | null;
  isOwnerAlert?: boolean;
  includePaymentLink?: boolean;
};

export type CreateSequenceInput = {
  businessId: string;
  name: string;
  relationshipTierId?: string | null;
  steps?: CreateSequenceStep[];
};

export interface SequenceStepDetail extends CreateSequenceStep {
  id: string;
  createdAt: string;
  updatedAt: string;
}
export interface SequenceWithSteps extends SequenceSummary {
  steps: SequenceStepDetail[];
}

export function createSequence(input: CreateSequenceInput): Promise<{ data: SequenceWithSteps }> {
  return apiClient(`/v1/sequences`, { method: "POST", body: JSON.stringify(input) });
}

export interface EnrollResult {
  enrolled: number;
  moved: number;
  skipped: number;
  items: { invoiceId: string; outcome: string; runId: string | null }[];
}

export interface AttachCustomerResult {
  customerId: string;
  overrideSet: boolean;
  enrollment: EnrollResult;
}

export function enrollInvoices(
  sequenceId: string,
  businessId: string,
  invoiceIds: string[],
): Promise<{ data: EnrollResult }> {
  return apiClient(`/v1/sequences/${sequenceId}/enroll?businessId=${businessId}`, {
    method: "POST",
    body: JSON.stringify({ invoiceIds }),
  });
}

export function attachCustomer(
  sequenceId: string,
  businessId: string,
  customerId: string,
): Promise<{ data: AttachCustomerResult }> {
  return apiClient(`/v1/sequences/${sequenceId}/attach-customer?businessId=${businessId}`, {
    method: "POST",
    body: JSON.stringify({ customerId }),
  });
}

export function getSequence(id: string, businessId: string): Promise<{ data: SequenceWithSteps }> {
  return apiClient(`/v1/sequences/${id}?businessId=${businessId}`);
}

export function pauseSequence(id: string, businessId: string): Promise<{ data: SequenceSummary }> {
  return apiClient(`/v1/sequences/${id}/pause?businessId=${businessId}`, { method: "POST" });
}

export function activateSequence(
  id: string,
  businessId: string,
): Promise<{ data: SequenceSummary }> {
  return apiClient(`/v1/sequences/${id}/activate?businessId=${businessId}`, { method: "POST" });
}

export function detachCustomer(
  id: string,
  businessId: string,
  customerId: string,
): Promise<{ data: { detached: boolean; stoppedRuns: number } }> {
  return apiClient(`/v1/sequences/${id}/detach-customer?businessId=${businessId}`, {
    method: "POST",
    body: JSON.stringify({ customerId }),
  });
}
