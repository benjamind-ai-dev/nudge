import { cn } from "../../lib/utils";
import type { AttentionRow } from "../../pages/dashboard/dashboard.view-model";

interface NeedsAttentionTableProps {
  rows: AttentionRow[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  onViewAll: () => void;
}

const HEAD_CLASS =
  "px-6 py-4 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]";

export function NeedsAttentionTable({
  rows,
  isLoading,
  error,
  onRetry,
  onViewAll,
}: NeedsAttentionTableProps) {
  return (
    <section className="flex flex-col rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-5">
        <h3 className="text-lg font-semibold tracking-[-0.01em] text-[#0F172A]">
          Needs your attention
        </h3>
      </div>

      {error ? (
        <p className="px-6 py-10 text-sm text-[#64748B]">
          Couldn&apos;t load attention items.{" "}
          <button
            type="button"
            onClick={onRetry}
            className="font-medium text-[#2563EB] hover:underline"
          >
            Retry
          </button>
        </p>
      ) : isLoading ? (
        <div className="space-y-3 p-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-gray-50" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-[#64748B]">
          Nothing needs your attention right now. 🎉
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead className="bg-[rgba(243,243,243,0.5)]">
              <tr>
                <th className={cn(HEAD_CLASS, "text-left")}>Customer</th>
                <th className={cn(HEAD_CLASS, "text-left")}>Invoice</th>
                <th className={cn(HEAD_CLASS, "text-right")}>Amount</th>
                <th className={cn(HEAD_CLASS, "text-center")}>Overdue</th>
                <th className={cn(HEAD_CLASS, "text-left")}>What happened</th>
                <th className={cn(HEAD_CLASS, "text-left")}>Type</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-[#E2E8F0]">
                  <td className="px-6 py-4 text-sm font-medium text-[#0F172A]">
                    {row.customerName}
                  </td>
                  <td className="px-6 py-4 text-xs text-[#64748B]">
                    {row.invoiceNumber}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-[#0F172A]">
                    {row.amount}
                  </td>
                  <td className="px-6 py-4 text-center text-xs font-semibold text-[#DC2626]">
                    {row.daysOverdue}d
                  </td>
                  <td className="max-w-[180px] px-6 py-4 text-xs italic text-[#64748B]">
                    {row.summary}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        "inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                        row.badge.className,
                      )}
                    >
                      {row.badge.label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && !error && rows.length > 0 && (
        <div className="border-t border-[#E2E8F0] bg-[rgba(243,243,243,0.2)] p-4">
          <button
            type="button"
            onClick={onViewAll}
            className="w-full py-2 text-center text-xs font-bold uppercase tracking-[0.1em] text-[#2563EB] hover:underline"
          >
            View all attention items
          </button>
        </div>
      )}
    </section>
  );
}
