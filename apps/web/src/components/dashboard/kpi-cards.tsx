import { Clock, DollarSign, Send, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Kpis {
  outstanding: { value: string; count: number };
  recovered: { value: string; pctChange: number };
  avgDaysToPay: { current: number; previous: number };
  activeSequences: number;
}

interface KpiCardsProps {
  kpis: Kpis | null;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}

function KpiCard({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="min-h-32 justify-between gap-0 py-0">
      <CardHeader className="flex flex-row items-start justify-between px-6 pt-6 pb-0">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-border">{icon}</span>
      </CardHeader>
      <CardContent className="px-6 pb-6">{children}</CardContent>
    </Card>
  );
}

export function KpiCards({ kpis, isLoading, error, onRetry }: KpiCardsProps) {
  if (error) {
    return (
      <Card className="px-6 py-6">
        <CardContent className="px-0 py-0 text-sm text-muted-foreground">
          Couldn&apos;t load your metrics.{" "}
          <Button variant="link" size="sm" className="h-auto p-0" onClick={onRetry}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !kpis) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  const pct = kpis.recovered.pctChange;
  const pctPositive = pct >= 0;

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard label="Total outstanding" icon={<DollarSign className="h-5 w-5" />}>
        <div className="flex items-end justify-between">
          <span className="text-2xl font-semibold text-foreground">
            {kpis.outstanding.value}
          </span>
          <Badge variant="destructive" className="bg-destructive/10 text-destructive">
            {kpis.outstanding.count}{" "}
            {kpis.outstanding.count === 1 ? "invoice" : "invoices"}
          </Badge>
        </div>
      </KpiCard>

      <KpiCard
        label="Recovered this month"
        icon={<TrendingUp className="h-5 w-5 text-primary" />}
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-2xl font-semibold text-foreground">
            {kpis.recovered.value}
          </span>
          <span className="flex items-center gap-1 text-[11px] font-medium">
            {pctPositive ? (
              <TrendingUp className="h-3 w-3 text-success" />
            ) : (
              <TrendingDown className="h-3 w-3 text-destructive" />
            )}
            <span className={pctPositive ? "text-success" : "text-destructive"}>
              {pctPositive ? "+" : ""}
              {pct}%
            </span>
            <span className="text-muted-foreground">vs last mo</span>
          </span>
        </div>
      </KpiCard>

      <KpiCard label="Avg days to pay" icon={<Clock className="h-5 w-5" />}>
        <div className="flex flex-col gap-0.5">
          <span className="text-2xl font-semibold text-foreground">
            {kpis.avgDaysToPay.current} days
          </span>
          <span className="text-[11px] font-medium italic text-muted-foreground">
            was {kpis.avgDaysToPay.previous} days
          </span>
        </div>
      </KpiCard>

      <KpiCard label="Active sequences" icon={<Send className="h-5 w-5" />}>
        <div className="flex flex-col gap-0.5">
          <span className="text-2xl font-semibold text-foreground">
            {kpis.activeSequences}
          </span>
          <span className="text-[11px] font-medium text-muted-foreground">
            Across all customers
          </span>
        </div>
      </KpiCard>
    </div>
  );
}
