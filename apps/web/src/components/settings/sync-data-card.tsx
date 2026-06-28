import { RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";

interface SyncDataCardProps {
  canResync: boolean;
  isResyncing: boolean;
  message: string | null;
  error: string | null;
  onResync: () => void;
}

export function SyncDataCard({
  canResync,
  isResyncing,
  message,
  error,
  onResync,
}: SyncDataCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Data</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Resync invoices</p>
            <p className="text-sm text-muted-foreground">
              Re-pull every invoice from your accounting provider. Use this to
              refresh details that may be out of date.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onResync}
            disabled={!canResync || isResyncing}
            className="shrink-0 gap-1.5"
          >
            <RefreshCw className={isResyncing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {isResyncing ? "Resyncing…" : "Resync all invoices"}
          </Button>
        </div>

        {message && (
          <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
            {message}
          </p>
        )}
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
