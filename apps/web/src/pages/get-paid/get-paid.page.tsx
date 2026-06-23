import { useGetPaidViewModel } from "./get-paid.view-model";
import { OverdueWorklist } from "../../components/get-paid/overdue-worklist";
import { StartFollowUpDialog } from "../../components/get-paid/start-follow-up-dialog";
import { formatDollars } from "../../lib/format";

export function GetPaidPage() {
  const vm = useGetPaidViewModel();

  // Hero block: show only when loaded and there are overdue invoices
  const showHero = !vm.isLoading && vm.overdueCount > 0;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-6 py-8 lg:px-10">
      {/* Hero money block — replaces soft urgency strip */}
      {showHero && (
        <div className="flex items-stretch gap-4">
          {/* Left accent rule */}
          <div className="w-1 shrink-0 rounded-full bg-[#DC2626]" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            {/* Eyebrow */}
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#64748B]">
              Get paid faster
            </span>
            {/* Hero number */}
            <span className="text-4xl font-bold leading-none tracking-tight tabular-nums text-[#DC2626]">
              {formatDollars(vm.totalOverdueCents)}
            </span>
            {/* Muted subline */}
            <span className="text-[13px] text-[#64748B]">
              overdue across {vm.overdueCount}{" "}
              {vm.overdueCount === 1 ? "invoice" : "invoices"}
            </span>
          </div>
        </div>
      )}

      {/* Page header — shown only when hero is hidden (loading / zero) */}
      {!showHero && (
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[#0F172A]">
            Get paid faster
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Overdue invoices sorted by amount at risk.
          </p>
        </div>
      )}

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
