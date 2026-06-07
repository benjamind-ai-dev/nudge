import { apiClient } from "./client";

export interface AuthorizeConnectionInput {
  businessId: string;
  provider: "quickbooks" | "xero";
}

export function authorizeConnection(
  input: AuthorizeConnectionInput,
): Promise<{ data: { oauthUrl: string } }> {
  return apiClient<{ data: { oauthUrl: string } }>("/v1/connections/authorize", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
