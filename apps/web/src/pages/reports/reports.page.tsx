import { Download, RefreshCw } from "lucide-react";
import { useReportsViewModel } from "./reports.view-model";
import { AgingSummaryCard } from "../../components/reports/aging-summary-card";
import { ReportFilterBar } from "../../components/reports/report-filter-bar";
import { AgingReportTable } from "../../components/reports/aging-report-table";
import { Button } from "@/components/ui/button";
import { cn } from "../../lib/utils";

export function ReportsPage() {
  const vm = useReportsViewModel();

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-6 py-8 lg:px-10">
      {/* Page header */}
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">
            A/R Aging Report
          </h2>
          <p className="text-sm text-muted-foreground">
            Outstanding balances grouped by how overdue they are.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={vm.handleExportCsv}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={vm.handleSyncNow}
            disabled={vm.isSyncing}
          >
            <RefreshCw className={cn("h-4 w-4", vm.isSyncing && "animate-spin")} />
            {vm.isSyncing ? "Syncing…" : "Sync now"}
          </Button>
        </div>
      </div>

      {(vm.syncMessage || vm.syncError) && (
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            vm.syncError
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
          )}
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
        dateRange={vm.dateRange}
        onDateRangeChange={vm.setDateRange}
        search={vm.search}
        onSearchChange={vm.setSearch}
        status={vm.status}
        statusOptions={vm.statusOptions}
        onStatusChange={vm.setStatus}
        sortValue={vm.sortValue}
        sortOptions={vm.sortOptions}
        onSortChange={vm.setSort}
      />

      <AgingReportTable
        rows={vm.rows}
        page={vm.page}
        pageSize={vm.pageSize}
        totalPages={vm.totalPages}
        filteredTotal={vm.filteredTotal}
        isLoading={vm.tableLoading}
        isLoadingMore={vm.isLoadingMore}
        error={vm.tableError}
        onRetry={vm.refetchTable}
        onPageChange={vm.setPage}
      />
    </div>
  );
}
