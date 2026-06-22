import { Check } from "lucide-react";
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
    <section className="flex flex-col rounded-xl border border-[#C5C6CF] bg-white shadow-sm">
      <div className="border-b border-[#C5C6CF] px-6 py-5">
        <h3 className="text-lg font-semibold tracking-[-0.01em] text-[#1A1C1C]">
          Recent wins
        </h3>
        <p className="text-[11px] text-[#45464E]">Your latest payments</p>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {error ? (
          <p className="px-2 py-6 text-sm text-[#45464E]">
            Couldn&apos;t load recent wins.{" "}
            <button
              type="button"
              onClick={onRetry}
              className="font-medium text-[#0B61A1] hover:underline"
            >
              Retry
            </button>
          </p>
        ) : isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-50" />
          ))
        ) : rows.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-[#45464E]">
            No payments yet — they&apos;ll show up here.
          </p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="flex gap-3 rounded-lg p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#D1FAE5]">
                <Check className="h-4 w-4 text-[#059669]" />
              </span>
              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-bold text-[#1A1C1C]">
                    {row.customerName}
                  </span>
                  <span className="shrink-0 text-[11px] font-bold text-[#059669]">
                    {row.amount}
                  </span>
                </div>
                <span className="text-xs text-[#45464E]">{row.description}</span>
                <span className="pt-1 text-[10px] uppercase text-[rgba(69,70,78,0.6)]">
                  {row.relativeTime}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
