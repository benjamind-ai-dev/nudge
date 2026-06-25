import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AgingSegment } from "../../pages/reports/reports.view-model";

interface AgingSummaryCardProps {
  segments: AgingSegment[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}

export function AgingSummaryCard({
  segments,
  isLoading,
  error,
  onRetry,
}: AgingSummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg tracking-[-0.01em]">Aging Summary</CardTitle>
      </CardHeader>

      <CardContent>
        {error ? (
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load the aging summary.{" "}
            <button
              type="button"
              onClick={onRetry}
              className="font-medium text-primary hover:underline"
            >
              Retry
            </button>
          </p>
        ) : isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-8 rounded-full" />
            <div className="grid grid-cols-2 gap-6 md:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8 flex h-8 overflow-hidden rounded-full bg-muted">
              {segments.map((s) =>
                s.widthPct > 0 ? (
                  <div
                    key={s.key}
                    className="transition-[width] duration-500"
                    style={{ width: `${s.widthPct}%`, backgroundColor: s.color }}
                    title={`${s.label}: ${s.amount}`}
                  />
                ) : null,
              )}
            </div>

            <div className="grid grid-cols-2 gap-6 md:grid-cols-5">
              {segments.map((s) => (
                <div key={s.key} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
                      {s.label}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-foreground">{s.amount}</p>
                  <p className="text-[13px] text-muted-foreground">
                    {s.count} {s.count === 1 ? "invoice" : "invoices"}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
