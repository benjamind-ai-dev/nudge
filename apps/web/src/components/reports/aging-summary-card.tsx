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
    <section className="rounded-xl border border-[#C5C6CF] bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-[-0.01em] text-[#1A1C1C]">
          Aging Summary
        </h3>
      </div>

      {error ? (
        <p className="text-sm text-[#45464E]">
          Couldn&apos;t load the aging summary.{" "}
          <button
            type="button"
            onClick={onRetry}
            className="font-medium text-[#0B61A1] hover:underline"
          >
            Retry
          </button>
        </p>
      ) : isLoading ? (
        <div className="space-y-6">
          <div className="h-8 animate-pulse rounded-full bg-gray-100" />
          <div className="grid grid-cols-2 gap-6 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded bg-gray-50" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="mb-8 flex h-8 overflow-hidden rounded-full bg-[#EEEEEE]">
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
                  <span className="text-xs font-medium uppercase tracking-[0.05em] text-[#45464E]">
                    {s.label}
                  </span>
                </div>
                <p className="text-lg font-bold text-[#041534]">{s.amount}</p>
                <p className="text-[13px] text-[#45464E]">
                  {s.count} {s.count === 1 ? "invoice" : "invoices"}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
