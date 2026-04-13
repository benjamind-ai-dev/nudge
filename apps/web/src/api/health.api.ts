import { apiClient } from "./client";

export interface HealthResponse {
  status: "ok" | "degraded";
  version: string;
  checks: Record<string, "ok" | "error">;
}

export function getHealth(): Promise<HealthResponse> {
  return apiClient<HealthResponse>("/health");
}
