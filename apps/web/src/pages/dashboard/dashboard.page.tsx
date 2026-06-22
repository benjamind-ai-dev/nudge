import { useDashboardViewModel } from "./dashboard.view-model";
import { DashboardHeader } from "../../components/dashboard/dashboard-header";
import { KpiCards } from "../../components/dashboard/kpi-cards";
import { ArAgingBar } from "../../components/dashboard/ar-aging-bar";
import { NeedsAttentionTable } from "../../components/dashboard/needs-attention-table";
import { RecentWinsCard } from "../../components/dashboard/recent-wins-card";

export function DashboardPage() {
  const vm = useDashboardViewModel();

  return (
    <div className="mx-auto flex max-w-[1040px] flex-col gap-8 p-8">
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
              ? "rounded-lg border border-[#FFB4AB] bg-[#FFDAD6] px-4 py-3 text-sm text-[#93000A]"
              : "rounded-lg border border-[#A7F3D0] bg-[#D1FAE5] px-4 py-3 text-sm text-[#065F46]"
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
