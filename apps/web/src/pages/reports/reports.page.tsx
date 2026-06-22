import { Download, RefreshCw } from "lucide-react";
import { useReportsViewModel } from "./reports.view-model";
import { AgingSummaryCard } from "../../components/reports/aging-summary-card";
import { ReportFilterBar } from "../../components/reports/report-filter-bar";
import { AgingReportTable } from "../../components/reports/aging-report-table";
import { cn } from "../../lib/utils";

export function ReportsPage() {
  const vm = useReportsViewModel();

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-6 py-8 lg:px-10">
      {/* Page header */}
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[#041534]">
            A/R Aging Report
          </h2>
          <p className="text-sm text-[#45464E]">
            Outstanding balances grouped by how overdue they are.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={vm.handleExportCsv}
            className="flex items-center gap-2 rounded-lg border border-[#75777F] px-4 py-2 text-sm font-semibold text-[#1A1C1C] transition-colors hover:bg-white"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={vm.handleSyncNow}
            disabled={vm.isSyncing}
            className="flex items-center gap-2 rounded-lg bg-[#0B61A1] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0a5690] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={cn("h-4 w-4", vm.isSyncing && "animate-spin")} />
            {vm.isSyncing ? "Syncing…" : "Sync now"}
          </button>
        </div>
      </div>

      {(vm.syncMessage || vm.syncError) && (
        <div
          className={
            vm.syncError
              ? "rounded-lg border border-[#FFB4AB] bg-[#FFDAD6] px-4 py-3 text-sm text-[#93000A]"
              : "rounded-lg border border-[#A7F3D0] bg-[#D1FAE5] px-4 py-3 text-sm text-[#065F46]"
          }
        >
          {vm.syncError ?? vm.syncMessage}
        </div>
      )}

      <AgingSummaryCard
        segments={vm.agingSegments}
        isLoading={vm.summaryLoading}
        error={vm.summaryError}
        onRetry={vm.refetchSummary}
      />

      <ReportFilterBar
        bucket={vm.bucket}
        bucketOptions={vm.bucketOptions}
        onBucketChange={vm.setBucket}
        customerSearch={vm.customerSearch}
        onCustomerSearchChange={vm.setCustomerSearch}
        status={vm.status}
        statusOptions={vm.statusOptions}
        onStatusChange={vm.setStatus}
        sortValue={vm.sortValue}
        sortOptions={vm.sortOptions}
        onSortChange={vm.setSort}
      />

      <AgingReportTable
        rows={vm.rows}
        pagination={vm.pagination}
        page={vm.page}
        isLoading={vm.tableLoading}
        error={vm.tableError}
        onRetry={vm.refetchTable}
        onRowClick={vm.handleRowClick}
        onPageChange={vm.setPage}
      />
    </div>
  );
}
