import { useGetPaidViewModel } from "./get-paid.view-model";
import { OverdueWorklist } from "../../components/get-paid/overdue-worklist";
import { StartFollowUpDialog } from "../../components/get-paid/start-follow-up-dialog";
import { formatDollars } from "../../lib/format";

export function GetPaidPage() {
  const vm = useGetPaidViewModel();

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-6 py-8 lg:px-10">
      {/* Page header — dashboard style */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[#0F172A]">
            Get paid faster
          </h2>
          {!vm.isLoading && vm.overdueCount > 0 ? (
            <p className="mt-1 text-base text-[#64748B]">
              <span className="font-semibold text-[#DC2626]">
                {formatDollars(vm.totalOverdueCents)}
              </span>{" "}
              overdue across {vm.overdueCount}{" "}
              {vm.overdueCount === 1 ? "invoice" : "invoices"}.
            </p>
          ) : (
            <p className="mt-1 text-base text-[#64748B]">
              Overdue invoices sorted by amount at risk.
            </p>
          )}
        </div>
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
