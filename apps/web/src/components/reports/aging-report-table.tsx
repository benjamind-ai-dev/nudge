import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import type { InvoiceRow } from "../../pages/reports/reports.view-model";

interface AgingReportTableProps {
  rows: InvoiceRow[];
  page: number;
  pageSize: number;
  totalPages: number;
  filteredTotal: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: unknown;
  onRetry: () => void;
  onPageChange: (p: number) => void;
}

const HEAD =
  "px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#64748B]";
const PILL = "inline-block rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide";

export function AgingReportTable({
  rows,
  page,
  pageSize,
  totalPages,
  filteredTotal,
  isLoading,
  isLoadingMore,
  error,
  onRetry,
  onPageChange,
}: AgingReportTableProps) {

  return (
    <section className="overflow-hidden rounded-xl md:border md:border-[#E2E8F0] md:bg-white md:shadow-sm">
      {error ? (
        <p className="px-6 py-12 text-sm text-[#64748B]">
          Couldn&apos;t load invoices.{" "}
          <button
            type="button"
            onClick={onRetry}
            className="font-medium text-[#2563EB] hover:underline"
          >
            Retry
          </button>
        </p>
      ) : isLoading ? (
        <div className="space-y-2 p-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-gray-50" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-[#64748B]">
          No invoices match these filters. 🎉
        </p>
      ) : (
        <>
        {/* Mobile: card list */}
        <div className="flex flex-col gap-3 md:hidden">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 text-left shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col">
                  <span className="font-bold text-[#041534]">{row.customerName}</span>
                  <span className="text-[11px] text-[#64748B]">
                    Invoice {row.invoiceNumber}
                  </span>
                </div>
                <span className={cn(PILL, row.statusClass)}>{row.statusLabel}</span>
              </div>
              <div className="flex items-end justify-between gap-2">
                <div className="flex flex-col">
                  <span className="mb-1 text-[11px] text-[#64748B]">
                    Due {row.dueDate}
                  </span>
                  <span className="text-lg font-extrabold text-[#041534]">
                    {row.amount}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase",
                      row.isOverdue ? "text-[#DC2626]" : "text-[#047857]",
                    )}
                  >
                    {row.isOverdue ? `${row.overdueLabel} late` : "On time"}
                  </span>
                  <span className={cn(PILL, row.bucketClass)}>{row.bucketLabel}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[840px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F1F5F9]">
                <th className={cn(HEAD, "pl-6")}>Customer</th>
                <th className={HEAD}>Invoice #</th>
                <th className={HEAD}>Due Date</th>
                <th className={cn(HEAD, "text-right")}>Amount</th>
                <th className={cn(HEAD, "text-right")}>Balance Due</th>
                <th className={HEAD}>Overdue</th>
                <th className={HEAD}>Bucket</th>
                <th className={cn(HEAD, "pr-6")}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-[15px]">
              {rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-black/[0.02]">
                  <td className="px-4 py-4 pl-6 font-semibold text-[#041534]">
                    {row.customerName}
                  </td>
                  <td className="px-4 py-4 text-[#64748B]">{row.invoiceNumber}</td>
                  <td className="px-4 py-4 text-[#0F172A]">{row.dueDate}</td>
                  <td className="px-4 py-4 text-right text-[#0F172A]">
                    {row.amount}
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-[#0F172A]">
                    {row.balanceDue}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-4 font-medium",
                      row.isOverdue ? "text-[#DC2626]" : "text-[#64748B]",
                    )}
                  >
                    {row.overdueLabel}
                  </td>
                  <td className="px-4 py-4">
                    <span className={cn(PILL, row.bucketClass)}>
                      {row.bucketLabel}
                    </span>
                  </td>
                  <td className="px-4 py-4 pr-6">
                    <span className={cn(PILL, row.statusClass)}>
                      {row.statusLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {!isLoading && !error && filteredTotal > 0 && (
        <div className="flex items-center justify-between border-t border-[#E2E8F0] bg-[#F1F5F9] px-6 py-4">
          <span className="text-sm text-[#64748B]">
            Showing {(page - 1) * pageSize + 1} to{" "}
            {Math.min(page * pageSize, filteredTotal)} of {filteredTotal} invoices
            {isLoadingMore && " (loading more…)"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              aria-label="Previous page"
              className="rounded border border-[#E2E8F0] p-1.5 transition-colors hover:bg-white disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-sm font-medium text-[#0F172A]">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              aria-label="Next page"
              className="rounded border border-[#E2E8F0] p-1.5 transition-colors hover:bg-white disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
