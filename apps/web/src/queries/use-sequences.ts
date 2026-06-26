import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSequences,
  deleteSequence,
  createSequence,
  enrollInvoices,
  attachCustomer,
  type SequenceSummary,
  type CreateSequenceInput,
} from "@/api/sequences.api";

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

export function useEnrollInvoices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sequenceId,
      businessId,
      invoiceIds,
    }: {
      sequenceId: string;
      businessId: string;
      invoiceIds: string[];
    }) => enrollInvoices(sequenceId, businessId, invoiceIds),
    onSuccess: (_r, { businessId }) => {
      void qc.invalidateQueries({ queryKey: ["sequences", businessId] });
      void qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useAttachCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sequenceId,
      businessId,
      customerId,
    }: {
      sequenceId: string;
      businessId: string;
      customerId: string;
    }) => attachCustomer(sequenceId, businessId, customerId),
    onSuccess: (_r, { businessId }) => {
      void qc.invalidateQueries({ queryKey: ["sequences", businessId] });
      void qc.invalidateQueries({ queryKey: ["customers", businessId] });
      void qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
