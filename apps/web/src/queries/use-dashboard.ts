import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getDashboardSummary,
  listNeedsAttention,
  listRecentWins,
} from "../api/dashboard.api";
import { triggerManualSync } from "../api/businesses.api";

export const dashboardKeys = {
  summary: (businessId: string) => ["dashboard", "summary", businessId] as const,
  needsAttention: (businessId: string, limit: number) =>
    ["dashboard", "needs-attention", businessId, limit] as const,
  recentWins: (businessId: string, limit: number) =>
    ["dashboard", "recent-wins", businessId, limit] as const,
};

export function useDashboardSummary(businessId: string) {
  return useQuery({
    queryKey: dashboardKeys.summary(businessId),
    queryFn: () => getDashboardSummary(businessId).then((r) => r.data),
    enabled: Boolean(businessId),
    staleTime: 30_000,
  });
}

export function useNeedsAttention(businessId: string, limit = 10) {
  return useQuery({
    queryKey: dashboardKeys.needsAttention(businessId, limit),
    queryFn: () => listNeedsAttention({ businessId, limit }).then((r) => r.data),
    enabled: Boolean(businessId),
    staleTime: 30_000,
  });
}

export function useRecentWins(businessId: string, limit = 5) {
  return useQuery({
    queryKey: dashboardKeys.recentWins(businessId, limit),
    queryFn: () => listRecentWins({ businessId, limit }).then((r) => r.data),
    enabled: Boolean(businessId),
    staleTime: 30_000,
  });
}

export function useTriggerSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (businessId: string) =>
      triggerManualSync(businessId).then((r) => r.data),
    onSuccess: () => {
      // Sync is async on the worker; refresh dashboard data so a quick sync
      // surfaces without a manual reload.
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
