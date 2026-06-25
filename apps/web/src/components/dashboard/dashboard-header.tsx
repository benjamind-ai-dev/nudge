import { ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h2>
        <p className="text-base text-muted-foreground">
          Welcome back{firstName ? `, ${firstName}` : ""}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={onSyncNow}
          disabled={isSyncing}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
          {isSyncing ? "Syncing…" : "Sync now"}
        </Button>
        <Button variant="default" onClick={onGoToInvoices}>
          Go to invoices
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
