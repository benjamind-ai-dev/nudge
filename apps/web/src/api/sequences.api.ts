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
}

export function getSequences(businessId: string): Promise<{ data: SequenceSummary[] }> {
  return apiClient(`/v1/sequences?businessId=${businessId}`);
}

export function deleteSequence(id: string, businessId: string): Promise<void> {
  return apiClient(`/v1/sequences/${id}?businessId=${businessId}`, { method: "DELETE" });
}
