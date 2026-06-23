import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AgingSegment } from "../../pages/dashboard/dashboard.view-model";

interface ArAgingBarProps {
  segments: AgingSegment[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  onViewReport: () => void;
}

export function ArAgingBar({
  segments,
  isLoading,
  error,
  onRetry,
  onViewReport,
}: ArAgingBarProps) {
  return (
    <Card className="card-lift gap-0 py-0">
      <CardHeader className="flex flex-row items-center justify-between px-6 py-5">
        <CardTitle className="text-base font-semibold">A/R Aging Balance</CardTitle>
        <Button variant="link" size="sm" className="h-auto p-0" onClick={onViewReport}>
          View Detailed Report
        </Button>
      </CardHeader>

      <CardContent className="px-6 pb-6">
        {error ? (
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load aging data.{" "}
            <Button variant="link" size="sm" className="h-auto p-0" onClick={onRetry}>
              Retry
            </Button>
          </p>
        ) : isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 rounded-full" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        ) : (
          <>
            {/* Aging bar — bucket colors are semantic; kept as hex per spec */}
            <div className="flex h-8 overflow-hidden rounded-full bg-muted">
              {segments.map((s) =>
                s.widthPct > 0 ? (
                  <div
                    key={s.key}
                    style={{ width: `${s.widthPct}%`, backgroundColor: s.color }}
                    title={`${s.label}: ${s.amount}`}
                  />
                ) : null,
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-3 lg:grid-cols-5">
              {segments.map((s) => (
                <div key={s.key} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    {/* Dot color is semantic — kept as hex per spec */}
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-xs font-medium text-muted-foreground">
                      {s.label}
                    </span>
                  </div>
                  <span className="text-lg font-semibold text-foreground">{s.amount}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {s.count} {s.count === 1 ? "invoice" : "invoices"}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
