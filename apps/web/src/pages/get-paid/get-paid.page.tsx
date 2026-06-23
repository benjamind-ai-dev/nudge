import { useGetPaidViewModel } from "./get-paid.view-model";
import { OverdueWorklist } from "../../components/get-paid/overdue-worklist";
import { StartFollowUpDialog } from "../../components/get-paid/start-follow-up-dialog";

export function GetPaidPage() {
  const vm = useGetPaidViewModel();

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-6 py-8 lg:px-10">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[#1B2A4A]">
          Get paid faster
        </h2>
        <p className="mt-1 text-sm text-[#6B7280]">
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
        onRetry={vm.refetch}
      />

      {/* Confirm dialog */}
      <StartFollowUpDialog
        isOpen={vm.isDialogOpen}
        invoiceNumber={vm.dialogInvoiceNumber}
        customerName={vm.dialogCustomerName}
        isPending={vm.isStarting}
        error={vm.startError}
        onConfirm={vm.handleStartFollowUp}
        onCancel={vm.closeDialog}
      />
    </div>
  );
}
