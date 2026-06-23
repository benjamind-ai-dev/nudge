import { Clock, DollarSign, Send, TrendingDown, TrendingUp } from "lucide-react";

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

function CardShell({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-32 flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.05em] text-[#64748B]">
          {label}
        </span>
        <span className="text-[#E2E8F0]">{icon}</span>
      </div>
      {children}
    </div>
  );
}

export function KpiCards({ kpis, isLoading, error, onRetry }: KpiCardsProps) {
  if (error) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 text-sm text-[#64748B]">
        Couldn&apos;t load your metrics.{" "}
        <button
          type="button"
          onClick={onRetry}
          className="font-medium text-[#2563EB] hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (isLoading || !kpis) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-xl border border-[#E2E8F0] bg-white"
          />
        ))}
      </div>
    );
  }

  const pct = kpis.recovered.pctChange;
  const pctPositive = pct >= 0;

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <CardShell label="Total outstanding" icon={<DollarSign className="h-5 w-5" />}>
        <div className="flex items-end justify-between">
          <span className="text-2xl font-bold text-[#0F172A]">
            {kpis.outstanding.value}
          </span>
          <span className="rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[11px] font-bold leading-tight text-[#991B1B]">
            {kpis.outstanding.count}{" "}
            {kpis.outstanding.count === 1 ? "invoice" : "invoices"}
          </span>
        </div>
      </CardShell>

      <CardShell
        label="Recovered this month"
        icon={<TrendingUp className="h-5 w-5 text-[#2563EB]" />}
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-2xl font-bold text-[#0F172A]">
            {kpis.recovered.value}
          </span>
          <span className="flex items-center gap-1 text-[11px] font-medium">
            {pctPositive ? (
              <TrendingUp className="h-3 w-3 text-[#059669]" />
            ) : (
              <TrendingDown className="h-3 w-3 text-[#DC2626]" />
            )}
            <span className={pctPositive ? "text-[#059669]" : "text-[#DC2626]"}>
              {pctPositive ? "+" : ""}
              {pct}%
            </span>
            <span className="text-[#64748B]">vs last mo</span>
          </span>
        </div>
      </CardShell>

      <CardShell label="Avg days to pay" icon={<Clock className="h-5 w-5" />}>
        <div className="flex flex-col gap-0.5">
          <span className="text-2xl font-bold text-[#0F172A]">
            {kpis.avgDaysToPay.current} days
          </span>
          <span className="text-[11px] font-medium italic text-[#64748B]">
            was {kpis.avgDaysToPay.previous} days
          </span>
        </div>
      </CardShell>

      <CardShell label="Active sequences" icon={<Send className="h-5 w-5" />}>
        <div className="flex flex-col gap-0.5">
          <span className="text-2xl font-bold text-[#0F172A]">
            {kpis.activeSequences}
          </span>
          <span className="text-[11px] font-medium text-[#64748B]">
            Across all customers
          </span>
        </div>
      </CardShell>
    </div>
  );
}
