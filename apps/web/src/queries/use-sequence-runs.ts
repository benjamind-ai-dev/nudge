import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listSequenceRuns,
  stopSequenceRun,
  type ListSequenceRunsParams,
  type SequenceRunStatus,
} from "@/api/sequence-runs.api";

export function useSequenceRuns(params: {
  businessId: string;
  sequenceId: string;
  status?: SequenceRunStatus;
}) {
  const { businessId, sequenceId, status } = params;
  return useQuery({
    queryKey: ["sequence-runs", businessId, sequenceId, status],
    queryFn: () =>
      listSequenceRuns({
        businessId,
        sequenceId,
        status,
        limit: 100,
      } satisfies ListSequenceRunsParams),
    enabled: Boolean(businessId) && Boolean(sequenceId),
    staleTime: 30_000,
  });
}

export function useStopSequenceRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, businessId }: { id: string; businessId: string }) =>
      stopSequenceRun(id, businessId),
    onSuccess: (_res, { businessId }) => {
      void qc.invalidateQueries({ queryKey: ["sequence-runs"] });
      void qc.invalidateQueries({ queryKey: ["sequences", businessId] });
    },
  });
}
