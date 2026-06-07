import { apiClient } from "./client";

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
