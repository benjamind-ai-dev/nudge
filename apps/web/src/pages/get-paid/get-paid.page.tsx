import { TriangleAlert } from "lucide-react";
import { useGetPaidViewModel } from "./get-paid.view-model";
import { OverdueWorklist } from "../../components/get-paid/overdue-worklist";
import { StartFollowUpDialog } from "../../components/get-paid/start-follow-up-dialog";
import { formatDollars } from "../../lib/format";

export function GetPaidPage() {
  const vm = useGetPaidViewModel();

  // Urgency strip totals are capped at the 100-invoice fetch limit.
  const showUrgency = !vm.isLoading && vm.overdueCount > 0;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-6 py-8 lg:px-10">
      {/* Urgency strip */}
      {showUrgency && (
        <div className="flex items-center gap-3 rounded-lg border border-[#BA1A1A]/20 bg-[#FFDAD6] px-6 py-3 text-[#93000A]">
          <TriangleAlert className="h-4 w-4 shrink-0 text-[#BA1A1A]" aria-hidden="true" />
          <span className="text-sm font-medium">
            Action Required:{" "}
            <span className="font-semibold">{formatDollars(vm.totalOverdueCents)}</span> overdue
            across {vm.overdueCount} {vm.overdueCount === 1 ? "invoice" : "invoices"}.
          </span>
        </div>
      )}

      {/* Page header */}
      <div>
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[#1A1C1C]">
          Get paid faster
        </h2>
        <p className="mt-1 text-sm text-[#45464E]">
          Overdue invoices sorted by amount at risk.
        </p>
      </div>

      {/* Already-running inline notice (appears after dialog closes) */}
      {vm.alreadyRunning && (
        <div className="rounded-lg border border-[#A7F3D0] bg-[#D1FAE5] px-4 py-3 text-sm text-[#065F46]">
          Already following up on this invoice — the sequence is active.
        </div>
      )}

      {/* Worklist table */}
      <OverdueWorklist
        rows={vm.rows}
        isLoading={vm.isLoading}
        error={vm.error}
        expandedId={vm.expandedId}
        onToggleExpand={vm.toggleExpand}
        onStartFollowUp={vm.openDialog}
        onViewSequence={vm.onViewSequence}
        onRetry={vm.refetch}
        page={vm.page}
        pageSize={vm.pageSize}
        totalPages={vm.totalPages}
        total={vm.total}
        onPageChange={vm.setPage}
      />

      {/* Confirm dialog */}
      <StartFollowUpDialog
        isOpen={vm.isDialogOpen}
        invoiceNumber={vm.dialogInvoiceNumber}
        customerName={vm.dialogCustomerName}
        amount={vm.dialogAmount}
        isPending={vm.isStarting}
        error={vm.startError}
        onConfirm={vm.handleStartFollowUp}
        onCancel={vm.closeDialog}
      />
    </div>
  );
}
