import { useGetPaidViewModel } from "./get-paid.view-model";
import { OverdueWorklist } from "../../components/get-paid/overdue-worklist";
import { StartFollowUpDialog } from "../../components/get-paid/start-follow-up-dialog";
import { formatDollars } from "../../lib/format";

export function GetPaidPage() {
  const vm = useGetPaidViewModel();

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 px-6 py-8 lg:px-10">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Get paid faster
        </h1>
        {!vm.isLoading && vm.overdueCount > 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-semibold text-destructive">
              {formatDollars(vm.totalOverdueCents)}
            </span>{" "}
            overdue across {vm.overdueCount}{" "}
            {vm.overdueCount === 1 ? "invoice" : "invoices"}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Overdue invoices sorted by amount at risk.
          </p>
        )}
      </div>

      {/* Already-running inline notice (appears after dialog closes) */}
      {vm.alreadyRunning && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
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
