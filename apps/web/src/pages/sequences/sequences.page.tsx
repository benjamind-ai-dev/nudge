import { useSequencesViewModel, type StatusFilter } from "./sequences.view-model";
import { SequenceTable } from "@/components/sequences/sequence-table";
import { DeleteSequenceDialog } from "@/components/sequences/delete-sequence-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const STATUS_TABS: StatusFilter[] = ["all", "active", "paused"];

export function SequencesPage() {
  const vm = useSequencesViewModel();
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 px-6 py-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sequences</h1>
          <p className="text-sm text-muted-foreground">Follow-up flows that chase your overdue invoices.</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Input placeholder="Filter by name…" value={vm.search} onChange={(e) => vm.setSearch(e.target.value)} className="max-w-xs" />
        <div className="flex gap-1 rounded-lg border p-1">
          {STATUS_TABS.map((s) => (
            <Button key={s} size="sm" variant={vm.statusFilter === s ? "secondary" : "ghost"}
              className="capitalize" onClick={() => vm.setStatusFilter(s)}>{s}</Button>
          ))}
        </div>
      </div>
      <SequenceTable rows={vm.rows} isLoading={vm.isLoading} error={vm.error} onRequestDelete={vm.requestDelete} />
      <DeleteSequenceDialog target={vm.deleteTarget} isDeleting={vm.isDeleting}
        onCancel={vm.cancelDelete} onConfirm={vm.confirmDelete} error={vm.deleteError} />
    </div>
  );
}
