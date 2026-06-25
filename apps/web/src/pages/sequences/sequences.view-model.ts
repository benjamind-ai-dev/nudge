import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useActiveBusinessId } from "@/lib/hooks/use-active-business-id";
import { useSequences, useDeleteSequence } from "@/queries/use-sequences";
import type { SequenceSummary } from "@/api/sequences.api";

export type StatusFilter = "all" | "active" | "paused";
export interface SequenceRow { id: string; name: string; tierName: string; stepCountLabel: string; isActive: boolean; statusLabel: string; activeRuns: number; }
export interface DeleteTarget { id: string; name: string; }

function toRow(s: SequenceSummary): SequenceRow {
  return {
    id: s.id, name: s.name,
    tierName: s.relationshipTier?.name ?? "—",
    stepCountLabel: `${s.stepCount} ${s.stepCount === 1 ? "step" : "steps"}`,
    isActive: s.isActive,
    statusLabel: s.isActive ? "Active" : "Paused",
    activeRuns: s.activeRuns,
  };
}

export function useSequencesViewModel() {
  const { businessId } = useActiveBusinessId();
  const navigate = useNavigate();
  const { data, isLoading, error } = useSequences(businessId);
  const deleteMut = useDeleteSequence();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const all = (data?.data ?? []).map(toRow);
    const q = search.trim().toLowerCase();
    return all.filter((r) =>
      (q === "" || r.name.toLowerCase().includes(q)) &&
      (statusFilter === "all" || (statusFilter === "active" ? r.isActive : !r.isActive)),
    );
  }, [data, search, statusFilter]);

  function requestDelete(r: SequenceRow) { setDeleteError(null); setDeleteTarget({ id: r.id, name: r.name }); }
  function cancelDelete() { setDeleteTarget(null); setDeleteError(null); }
  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync({ id: deleteTarget.id, businessId });
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not delete this sequence.");
    }
  }

  return {
    rows, isLoading, error: error instanceof Error ? error.message : error ? String(error) : null,
    search, setSearch, statusFilter, setStatusFilter,
    deleteTarget, requestDelete, cancelDelete, confirmDelete,
    isDeleting: deleteMut.isPending, deleteError,
    goToNew: () => navigate("/sequences/new"),
  };
}
