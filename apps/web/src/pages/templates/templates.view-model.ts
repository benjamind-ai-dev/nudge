import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useActiveBusinessId } from "../../lib/hooks/use-active-business-id";
import { useDeleteTemplate, useTemplates } from "../../queries/use-templates";

export interface TemplateRow {
  id: string;
  name: string;
  subjectPreview: string;
  updatedLabel: string;
}

interface DeleteTarget {
  id: string;
  name: string;
}

function formatUpdated(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `Edited ${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `Edited ${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `Edited ${days}d ago`;
  return `Edited ${Math.round(days / 7)}w ago`;
}

export function useTemplatesViewModel() {
  const navigate = useNavigate();
  const { businessId } = useActiveBusinessId();
  const { data, isLoading, error, refetch } = useTemplates(businessId);
  const deleteMut = useDeleteTemplate();

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const rows: TemplateRow[] = useMemo(
    () =>
      (data?.data ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        subjectPreview: t.subject?.trim() ? t.subject : "No subject",
        updatedLabel: formatUpdated(t.updatedAt),
      })),
    [data],
  );

  function openDelete(target: DeleteTarget) {
    setDeleteTarget(target);
  }
  function closeDelete() {
    setDeleteTarget(null);
  }
  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteMut.mutateAsync({ id: deleteTarget.id, businessId });
    setDeleteTarget(null);
  }

  return {
    rows,
    isLoading,
    error,
    refetch,
    deleteTarget,
    openDelete,
    closeDelete,
    confirmDelete,
    isDeleting: deleteMut.isPending,
    goToNew: () => navigate("/templates/new"),
    goToEdit: (id: string) => navigate(`/templates/${id}`),
  };
}
