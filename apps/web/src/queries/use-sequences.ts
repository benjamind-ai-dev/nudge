import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSequences, deleteSequence, createSequence, type SequenceSummary, type CreateSequenceInput } from "@/api/sequences.api";

export function useSequences(businessId: string) {
  return useQuery<{ data: SequenceSummary[] }>({
    queryKey: ["sequences", businessId],
    queryFn: () => getSequences(businessId),
    enabled: Boolean(businessId),
    staleTime: 30_000,
  });
}

export function useDeleteSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, businessId }: { id: string; businessId: string }) => deleteSequence(id, businessId),
    onSuccess: (_res, { businessId }) => {
      void qc.invalidateQueries({ queryKey: ["sequences", businessId] });
    },
  });
}

export function useCreateSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSequenceInput) => createSequence(input),
    onSuccess: (_res, input) => {
      void qc.invalidateQueries({ queryKey: ["sequences", input.businessId] });
    },
  });
}
