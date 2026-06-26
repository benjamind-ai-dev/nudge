import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSequences,
  getSequence,
  deleteSequence,
  createSequence,
  enrollInvoices,
  attachCustomer,
  pauseSequence,
  activateSequence,
  detachCustomer,
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

export function useSequence(id: string, businessId: string) {
  return useQuery({
    queryKey: ["sequences", businessId, id],
    queryFn: () => getSequence(id, businessId),
    enabled: Boolean(id) && Boolean(businessId),
    staleTime: 30_000,
  });
}

export function usePauseSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, businessId }: { id: string; businessId: string }) =>
      pauseSequence(id, businessId),
    onSuccess: (_res, { id, businessId }) => {
      void qc.invalidateQueries({ queryKey: ["sequences", businessId] });
      void qc.invalidateQueries({ queryKey: ["sequences", businessId, id] });
      void qc.invalidateQueries({ queryKey: ["sequence-runs"] });
      void qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useActivateSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, businessId }: { id: string; businessId: string }) =>
      activateSequence(id, businessId),
    onSuccess: (_res, { id, businessId }) => {
      void qc.invalidateQueries({ queryKey: ["sequences", businessId] });
      void qc.invalidateQueries({ queryKey: ["sequences", businessId, id] });
      void qc.invalidateQueries({ queryKey: ["sequence-runs"] });
      void qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useDetachCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      businessId,
      customerId,
    }: {
      id: string;
      businessId: string;
      customerId: string;
    }) => detachCustomer(id, businessId, customerId),
    onSuccess: (_res, { id, businessId }) => {
      void qc.invalidateQueries({ queryKey: ["sequences", businessId] });
      void qc.invalidateQueries({ queryKey: ["sequences", businessId, id] });
      void qc.invalidateQueries({ queryKey: ["sequence-runs"] });
      void qc.invalidateQueries({ queryKey: ["invoices"] });
    },
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
      void qc.invalidateQueries({ queryKey: ["sequence-runs"] });
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
      void qc.invalidateQueries({ queryKey: ["sequence-runs"] });
    },
  });
}
