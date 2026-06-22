import { ArrowRight, RefreshCw } from "lucide-react";
import { cn } from "../../lib/utils";

interface DashboardHeaderProps {
  firstName: string | null;
  isSyncing: boolean;
  onSyncNow: () => void;
  onGoToInvoices: () => void;
}

export function DashboardHeader({
  firstName,
  isSyncing,
  onSyncNow,
  onGoToInvoices,
}: DashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[#1A1C1C]">
          Dashboard
        </h2>
        <p className="text-base text-[#45464E]">
          Welcome back{firstName ? `, ${firstName}` : ""}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSyncNow}
          disabled={isSyncing}
          className="flex h-10 items-center gap-2 rounded-lg border border-[#C5C6CF] bg-white px-4 text-sm font-medium text-[#1A1C1C] transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
          {isSyncing ? "Syncing…" : "Sync now"}
        </button>
        <button
          type="button"
          onClick={onGoToInvoices}
          className="flex h-10 items-center gap-2 rounded-lg bg-[#0B61A1] px-4 text-sm font-medium text-white transition-colors hover:bg-[#0a5690]"
        >
          Go to invoices
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
