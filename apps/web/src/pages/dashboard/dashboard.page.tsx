import { useDashboardViewModel } from "./dashboard.view-model";
import { DashboardHeader } from "../../components/dashboard/dashboard-header";
import { KpiCards } from "../../components/dashboard/kpi-cards";
import { ArAgingBar } from "../../components/dashboard/ar-aging-bar";
import { NeedsAttentionTable } from "../../components/dashboard/needs-attention-table";
import { RecentWinsCard } from "../../components/dashboard/recent-wins-card";

export function DashboardPage() {
  const vm = useDashboardViewModel();

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-6 py-8 lg:px-10">
      <DashboardHeader
        firstName={vm.firstName}
        isSyncing={vm.isSyncing}
        onSyncNow={vm.handleSyncNow}
        onGoToInvoices={vm.goToInvoices}
      />

      {(vm.syncMessage || vm.syncError) && (
        <div
          className={
            vm.syncError
              ? "rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              : "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
          }
        >
          {vm.syncError ?? vm.syncMessage}
        </div>
      )}

      <KpiCards
        kpis={vm.kpis}
        isLoading={vm.summaryLoading}
        error={vm.summaryError}
        onRetry={vm.refetchSummary}
      />

      <ArAgingBar
        segments={vm.agingSegments}
        isLoading={vm.summaryLoading}
        error={vm.summaryError}
        onRetry={vm.refetchSummary}
        onViewReport={vm.goToReports}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <NeedsAttentionTable
            rows={vm.attentionRows}
            isLoading={vm.attentionLoading}
            error={vm.attentionError}
            onRetry={vm.refetchAttention}
            onViewAll={vm.goToInvoices}
          />
        </div>
        <div className="lg:col-span-1">
          <RecentWinsCard
            rows={vm.winRows}
            isLoading={vm.winsLoading}
            error={vm.winsError}
            onRetry={vm.refetchWins}
          />
        </div>
      </div>
    </div>
  );
}
