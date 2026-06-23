import { ChevronDown, ChevronRight, Copy, Send, Eye, PlayCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import type { FollowUpStatus, OverdueRow } from "../../pages/get-paid/get-paid.view-model";

// ---- Column header style ---------------------------------------------------
const HEAD =
  "px-4 py-4 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#45464E]";

// ---- Follow-up status pill -------------------------------------------------
const FOLLOW_UP_PILL: Record<FollowUpStatus, string> = {
  none: "border border-[#D1D5DB] bg-transparent text-[#6B7280]",
  active: "bg-[#10B981]/[0.12] text-[#059669]",
  paused: "bg-[#FBBF24]/[0.15] text-[#B45309]",
};

const FOLLOW_UP_LABEL: Record<FollowUpStatus, string> = {
  none: "No sequence",
  active: "Active",
  paused: "Paused",
};

// ---- Props -----------------------------------------------------------------
interface OverdueWorklistProps {
  rows: OverdueRow[];
  isLoading: boolean;
  error: unknown;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  onStartFollowUp: (row: OverdueRow) => void;
  onRetry: () => void;
}

// ---- Expanded inset panel --------------------------------------------------
function ExpandedPanel({ row }: { row: OverdueRow }) {
  return (
    <div className="border-t border-[#E5E7EB] bg-[#F9FAFB] px-6 py-5">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Invoice block */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#6B7280]">
            Invoice
          </h3>
          <div className="space-y-1.5 text-sm">
            {row.issuedDate && (
              <div className="flex items-center justify-between">
                <span className="text-[#6B7280]">Issued</span>
                <span className="text-[#1B2A4A]">{row.issuedDate}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[#6B7280]">Due</span>
              <span className="text-[#BA1A1A]">{row.dueDate}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#6B7280]">Balance due</span>
              <span className="font-bold tabular-nums text-[#BA1A1A]">{row.balanceDue}</span>
            </div>
          </div>
          {row.paymentLinkUrl && (
            <a
              href={row.paymentLinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0B61A1] hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                void navigator.clipboard.writeText(row.paymentLinkUrl!);
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy payment link
            </a>
          )}
        </div>

        {/* Email history + Next step placeholders */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#6B7280]">
              Email history
            </h3>
            <p className="text-sm text-[#6B7280]">No activity yet</p>
          </div>
          <div className="space-y-1.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#6B7280]">
              Next step
            </h3>
            <p className="text-sm text-[#6B7280]">No activity yet</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Action button ---------------------------------------------------------
function ActionButton({
  status,
  row,
  onStartFollowUp,
}: {
  status: FollowUpStatus;
  row: OverdueRow;
  onStartFollowUp: (row: OverdueRow) => void;
}) {
  if (status === "none") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onStartFollowUp(row);
        }}
        className="flex items-center gap-1.5 rounded-md bg-[#10B981] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#059669]"
      >
        <Send className="h-3.5 w-3.5" />
        Start follow-up
      </button>
    );
  }
  if (status === "active") {
    return (
      <button
        type="button"
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-1.5 rounded-md border border-[#D1D5DB] px-3 py-1.5 text-xs font-semibold text-[#45464E] transition-colors hover:bg-white"
      >
        <Eye className="h-3.5 w-3.5" />
        View sequence
      </button>
    );
  }
  // paused
  return (
    <button
      type="button"
      onClick={(e) => e.stopPropagation()}
      className="flex items-center gap-1.5 rounded-md border border-[#D1D5DB] px-3 py-1.5 text-xs font-semibold text-[#45464E] transition-colors hover:bg-white"
    >
      <PlayCircle className="h-3.5 w-3.5" />
      Resume
    </button>
  );
}

// ---- Main component --------------------------------------------------------
export function OverdueWorklist({
  rows,
  isLoading,
  error,
  expandedId,
  onToggleExpand,
  onStartFollowUp,
  onRetry,
}: OverdueWorklistProps) {
  if (error) {
    return (
      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
        <p className="px-6 py-12 text-sm text-[#45464E]">
          Couldn&apos;t load overdue invoices.{" "}
          <button
            type="button"
            onClick={onRetry}
            className="font-medium text-[#0B61A1] hover:underline"
          >
            Retry
          </button>
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
        <div className="space-y-2 p-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-50" />
          ))}
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
        <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
          <span className="text-4xl">🎉</span>
          <p className="text-base font-semibold text-[#1B2A4A]">
            No overdue invoices
          </p>
          <p className="max-w-xs text-sm text-[#6B7280]">
            All outstanding invoices are on time. Check back soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
      {/* Mobile: card list */}
      <div className="flex flex-col md:hidden">
        {rows.map((row) => (
          <div key={row.id} className="border-b border-[#E5E7EB] last:border-b-0">
            <button
              type="button"
              className="w-full p-4 text-left"
              onClick={() => onToggleExpand(row.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-[#1B2A4A]">{row.customerName}</span>
                  <span className="text-[11px] text-[#6B7280]">{row.invoiceNumber}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      "inline-block rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                      FOLLOW_UP_PILL[row.followUpStatus],
                    )}
                  >
                    {FOLLOW_UP_LABEL[row.followUpStatus]}
                  </span>
                  {expandedId === row.id ? (
                    <ChevronDown className="h-4 w-4 text-[#6B7280]" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-[#6B7280]" />
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-end justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-[#6B7280]">Due {row.dueDate}</span>
                  <span className="font-bold tabular-nums text-[#BA1A1A]">
                    {row.balanceDue}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: row.agingDotColor }}
                  />
                  <span className="text-xs font-medium text-[#BA1A1A]">
                    {row.daysOverdue}d overdue
                  </span>
                </div>
              </div>
              <div className="mt-3">
                <ActionButton
                  status={row.followUpStatus}
                  row={row}
                  onStartFollowUp={onStartFollowUp}
                />
              </div>
            </button>
            {expandedId === row.id && <ExpandedPanel row={row} />}
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
              <th className={cn(HEAD, "pl-6 w-8")} />
              <th className={HEAD}>Customer</th>
              <th className={HEAD}>Invoice #</th>
              <th className={HEAD}>Due Date</th>
              <th className={cn(HEAD, "text-right")}>Overdue</th>
              <th className={cn(HEAD, "text-right")}>Balance Due</th>
              <th className={HEAD}>Status</th>
              <th className={cn(HEAD, "pr-6")}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <>
                <tr
                  key={row.id}
                  onClick={() => onToggleExpand(row.id)}
                  className={cn(
                    "cursor-pointer border-b border-[#E5E7EB] transition-colors hover:bg-black/[0.02]",
                    expandedId === row.id && "bg-[#F9FAFB]",
                  )}
                >
                  {/* Expand chevron */}
                  <td className="pl-6 pr-2 py-4">
                    {expandedId === row.id ? (
                      <ChevronDown className="h-4 w-4 text-[#6B7280]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[#6B7280]" />
                    )}
                  </td>

                  {/* Customer */}
                  <td className="px-4 py-4">
                    <span className="font-semibold text-[#1B2A4A]">{row.customerName}</span>
                  </td>

                  {/* Invoice # */}
                  <td className="px-4 py-4 text-sm text-[#6B7280]">{row.invoiceNumber}</td>

                  {/* Due date */}
                  <td className="px-4 py-4 text-sm text-[#BA1A1A]">{row.dueDate}</td>

                  {/* Overdue days */}
                  <td className="px-4 py-4 text-right">
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: row.agingDotColor }}
                      />
                      <span className="text-sm font-medium tabular-nums text-[#BA1A1A]">
                        {row.daysOverdue}d
                      </span>
                    </span>
                  </td>

                  {/* Balance due */}
                  <td className="px-4 py-4 text-right font-bold tabular-nums text-[#BA1A1A]">
                    {row.balanceDue}
                  </td>

                  {/* Follow-up status pill */}
                  <td className="px-4 py-4">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                        FOLLOW_UP_PILL[row.followUpStatus],
                      )}
                    >
                      {FOLLOW_UP_LABEL[row.followUpStatus]}
                    </span>
                  </td>

                  {/* Action button */}
                  <td className="px-4 py-4 pr-6">
                    <ActionButton
                      status={row.followUpStatus}
                      row={row}
                      onStartFollowUp={onStartFollowUp}
                    />
                  </td>
                </tr>

                {expandedId === row.id && (
                  <tr key={`${row.id}-expanded`} className="border-b border-[#E5E7EB]">
                    <td colSpan={8} className="p-0">
                      <ExpandedPanel row={row} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer row count */}
      <div className="border-t border-[#E5E7EB] bg-[#F9FAFB] px-6 py-3">
        <span className="text-sm text-[#6B7280]">
          {rows.length} overdue {rows.length === 1 ? "invoice" : "invoices"}
        </span>
      </div>
    </div>
  );
}
