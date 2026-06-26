import { useSequencesViewModel, type StatusFilter } from "./sequences.view-model";
import { SequenceList } from "@/components/sequences/sequence-list";
import { DeleteSequenceDialog } from "@/components/sequences/delete-sequence-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const STATUS_TABS: StatusFilter[] = ["all", "active", "paused"];

export function SequencesPage() {
  const vm = useSequencesViewModel();
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 px-6 py-6 lg:px-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sequences</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Follow-up flows that chase your overdue invoices.
          </p>
        </div>
        <Button onClick={vm.goToNew}>+ New sequence</Button>
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Filter by name…"
          value={vm.search}
          onChange={(e) => vm.setSearch(e.target.value)}
          className="w-56"
        />
        <div className="flex gap-1 rounded-lg border p-1">
          {STATUS_TABS.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={vm.statusFilter === s ? "secondary" : "ghost"}
              className="capitalize"
              onClick={() => vm.setStatusFilter(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      <SequenceList
        rows={vm.rows}
        isLoading={vm.isLoading}
        error={vm.error}
        onRequestDelete={vm.requestDelete}
        onOpen={vm.goToDetail}
      />

      <DeleteSequenceDialog
        target={vm.deleteTarget}
        isDeleting={vm.isDeleting}
        onCancel={vm.cancelDelete}
        onConfirm={vm.confirmDelete}
        error={vm.deleteError}
      />
    </div>
  );
}
