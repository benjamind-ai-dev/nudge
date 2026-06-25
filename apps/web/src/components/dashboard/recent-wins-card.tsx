import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { WinRow } from "../../pages/dashboard/dashboard.view-model";

interface RecentWinsCardProps {
  rows: WinRow[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}

export function RecentWinsCard({
  rows,
  isLoading,
  error,
  onRetry,
}: RecentWinsCardProps) {
  return (
    <Card className="card-lift gap-0 py-0">
      <CardHeader className="border-b px-6 py-5 [.border-b]:pb-6">
        <CardTitle className="text-base font-semibold">Recent wins</CardTitle>
        <CardDescription>Your latest payments</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 p-4">
        {error ? (
          <p className="px-2 py-6 text-sm text-muted-foreground">
            Couldn&apos;t load recent wins.{" "}
            <button
              type="button"
              onClick={onRetry}
              className="font-medium text-primary hover:underline"
            >
              Retry
            </button>
          </p>
        ) : isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))
        ) : rows.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            No payments yet — they&apos;ll show up here.
          </p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="flex gap-3 rounded-lg p-3">
              {/* Emerald success icon — semantic color kept */}
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                <Check className="h-4 w-4 text-emerald-400" />
              </span>
              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {row.customerName}
                  </span>
                  {/* Emerald success amount — semantic color kept */}
                  <span className="shrink-0 text-[11px] font-semibold text-emerald-400">
                    {row.amount}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{row.description}</span>
                <span className="pt-1 text-[10px] uppercase text-muted-foreground/60">
                  {row.relativeTime}
                </span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
