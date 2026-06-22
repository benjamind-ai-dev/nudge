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
    <section className="rounded-xl border border-[#C5C6CF] bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-[-0.01em] text-[#1A1C1C]">
          A/R Aging Balance
        </h3>
        <button
          type="button"
          onClick={onViewReport}
          className="text-sm font-semibold text-[#0B61A1] hover:underline"
        >
          View Detailed Report
        </button>
      </div>

      {error ? (
        <p className="mt-6 text-sm text-[#45464E]">
          Couldn&apos;t load aging data.{" "}
          <button
            type="button"
            onClick={onRetry}
            className="font-medium text-[#0B61A1] hover:underline"
          >
            Retry
          </button>
        </p>
      ) : isLoading ? (
        <div className="mt-6 space-y-4">
          <div className="h-8 animate-pulse rounded-full bg-gray-100" />
          <div className="h-10 animate-pulse rounded bg-gray-50" />
        </div>
      ) : (
        <>
          <div className="mt-6 flex h-8 overflow-hidden rounded-full bg-gray-100">
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

          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[#C5C6CF] pt-4 sm:grid-cols-3 lg:grid-cols-5">
            {segments.map((s) => (
              <div key={s.key} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-xs font-semibold text-[#45464E]">
                    {s.label}
                  </span>
                </div>
                <span className="text-lg font-bold text-[#1A1C1C]">{s.amount}</span>
                <span className="text-[10px] text-[#45464E]">
                  {s.count} {s.count === 1 ? "invoice" : "invoices"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
