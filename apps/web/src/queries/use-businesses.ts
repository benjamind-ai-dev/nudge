import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createBusiness,
  listBusinesses,
  triggerManualSync,
  type BusinessWithConnections,
  type CreateBusinessInput,
} from "../api/businesses.api";

export function useBusinesses() {
  return useQuery({
    queryKey: ["businesses"],
    queryFn: () => listBusinesses().then((r) => r.data),
  });
}

export function useCreateBusiness() {
  return useMutation({
    mutationFn: (input: CreateBusinessInput) =>
      createBusiness(input).then((r) => r.data),
  });
}

export function useTriggerManualSync() {
  return useMutation({
    mutationFn: ({ businessId, full }: { businessId: string; full?: boolean }) =>
      triggerManualSync(businessId, { full }).then((r) => r.data),
  });
}

export type { BusinessWithConnections };
