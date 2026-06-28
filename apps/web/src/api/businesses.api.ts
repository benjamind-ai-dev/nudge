import { apiClient } from "./client";

export interface BusinessConnection {
  provider: string;
  status: string;
}

export interface BusinessWithConnections {
  id: string;
  name: string;
  accountingProvider: "quickbooks" | "xero";
  senderName: string;
  senderEmail: string;
  timezone: string;
  emailSignature: string | null;
  isActive: boolean;
  connections: BusinessConnection[];
}

export interface CreateBusinessInput {
  name: string;
  accountingProvider: "quickbooks" | "xero";
  senderName: string;
  senderEmail: string;
  timezone: string;
  emailSignature?: string;
}

export interface Business {
  id: string;
  name: string;
  accountingProvider: "quickbooks" | "xero";
  senderName: string;
  senderEmail: string;
  timezone: string;
  emailSignature: string | null;
}

export function createBusiness(
  input: CreateBusinessInput,
): Promise<{ data: { id: string } }> {
  return apiClient<{ data: { id: string } }>("/v1/businesses", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listBusinesses(): Promise<{ data: BusinessWithConnections[] }> {
  return apiClient<{ data: BusinessWithConnections[] }>("/v1/businesses");
}

export interface ManualSyncResult {
  message: string;
  jobId: string;
}

export function triggerManualSync(
  businessId: string,
  opts: { full?: boolean } = {},
): Promise<{ data: ManualSyncResult }> {
  return apiClient<{ data: ManualSyncResult }>(`/v1/businesses/${businessId}/sync`, {
    method: "POST",
    body: JSON.stringify(opts.full ? { full: true } : {}),
  });
}
