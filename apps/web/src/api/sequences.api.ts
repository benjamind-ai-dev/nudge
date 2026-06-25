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
