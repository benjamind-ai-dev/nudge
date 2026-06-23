import { Fragment, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  PlayCircle,
  ReceiptText,
  History,
  ArrowRight,
  Send,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type { FollowUpStatus, OverdueRow } from "../../pages/get-paid/get-paid.view-model";

// ---- Column header style ---------------------------------------------------
const HEAD =
  "px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#45464E]";

// ---- Card section label style ----------------------------------------------
const CARD_LABEL =
  "text-[10px] font-semibold uppercase tracking-[0.07em] text-[#45464E]";

// ---- Follow-up status pill -------------------------------------------------
const FOLLOW_UP_PILL: Record<FollowUpStatus, string> = {
  // Active status pill keeps green tint — it's a status indicator, not a button
  none: "border border-[#C5C6CF] bg-transparent text-[#45464E]",
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
  // Deep-linking to a specific sequence run is a follow-up TODO. Both
  // "View sequence" and "Resume" navigate to the Sequences list page for now.
  onViewSequence: () => void;
  onRetry: () => void;
  // Pagination
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
}

// ---- Expanded panel — three bordered white cards ---------------------------
function ExpandedPanel({ row }: { row: OverdueRow }) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(row.paymentLinkUrl!).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="border-t border-[#C5C6CF] bg-[#F3F3F3] px-6 p-4">
      <div className="grid items-stretch gap-4 md:grid-cols-3">
        {/* Card 1: Invoice Details */}
        <div className="flex flex-col gap-3 rounded-xl border border-[#C5C6CF] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-1.5">
            <ReceiptText className="h-3.5 w-3.5 text-[#45464E]" aria-hidden="true" />
            <span className={CARD_LABEL}>Invoice Details</span>
          </div>
          <div className="flex flex-col gap-1.5 text-sm">
            {row.issuedDate && (
              <div className="flex items-center justify-between">
                <span className="text-[#45464E]">Issued</span>
                <span className="text-[#1A1C1C]">{row.issuedDate}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[#45464E]">Due</span>
              <span className="text-[#45464E]">{row.dueDate}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#45464E]">Balance due</span>
              <span className="font-bold tabular-nums text-[#1A1C1C]">{row.balanceDue}</span>
            </div>
          </div>
          {row.paymentLinkUrl && (
            <button
              type="button"
              onClick={handleCopyLink}
              className="mt-auto flex w-full items-center justify-center gap-1.5 rounded-md border border-[#C5C6CF] px-3 py-2 text-xs font-medium text-[#45464E] transition-colors hover:bg-[#F3F3F3]"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copied!" : "Copy payment link"}
            </button>
          )}
        </div>

        {/* Card 2: Recent Activity */}
        <div className="flex flex-col gap-3 rounded-xl border border-[#C5C6CF] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-1.5">
            <History className="h-3.5 w-3.5 text-[#45464E]" aria-hidden="true" />
            <span className={CARD_LABEL}>Recent Activity</span>
          </div>
          {/* DO NOT invent reminder events — show placeholder only */}
          <p className="text-sm text-[#45464E]">No activity yet</p>
        </div>

        {/* Card 3: Next Action */}
        <div className="flex flex-col gap-3 rounded-xl border border-[#C5C6CF] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-1.5">
            <ArrowRight className="h-3.5 w-3.5 text-[#45464E]" aria-hidden="true" />
            <span className={CARD_LABEL}>Next Action</span>
          </div>
          {/* Sequences editor doesn't exist yet — show placeholder only */}
          <p className="text-sm text-[#45464E]">No activity yet</p>
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
  onViewSequence,
}: {
  status: FollowUpStatus;
  row: OverdueRow;
  onStartFollowUp: (row: OverdueRow) => void;
  onViewSequence: () => void;
}) {
  if (status === "none") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onStartFollowUp(row);
        }}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#0B61A1] px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#0a5690]"
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
        onClick={(e) => {
          e.stopPropagation();
          // Deep-linking to the specific sequence run is a follow-up TODO.
          onViewSequence();
        }}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#C5C6CF] px-3 text-xs font-semibold text-[#45464E] transition-colors hover:bg-white"
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
      onClick={(e) => {
        e.stopPropagation();
        // Deep-linking to the specific sequence run is a follow-up TODO.
        onViewSequence();
      }}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#C5C6CF] px-3 text-xs font-semibold text-[#45464E] transition-colors hover:bg-white"
    >
      <PlayCircle className="h-3.5 w-3.5" />
      Resume
    </button>
  );
}

// ---- Pagination footer (mirrors Reports) -----------------------------------
function PaginationFooter({
  page,
  pageSize,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // Show numbered page buttons (up to 7, with ellipsis handled simply)
  const pageNumbers: number[] = [];
  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="flex items-center justify-between border-t border-[#C5C6CF] bg-[#F3F3F3] px-6 py-4">
      <span className="text-sm text-[#45464E]">
        Showing {from} to {to} of {total} entries
      </span>
      <div className="flex items-center gap-1">
        {/* Prev */}
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="flex h-8 w-8 items-center justify-center rounded border border-[#C5C6CF] transition-colors hover:bg-white disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Page numbers */}
        {pageNumbers.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPageChange(n)}
            aria-label={`Page ${n}`}
            aria-current={n === page ? "page" : undefined}
            className={cn(
              "h-8 min-w-[2rem] rounded border px-2 text-sm font-medium transition-colors",
              n === page
                ? "border-[#0B61A1] bg-[#0B61A1] text-white"
                : "border-[#C5C6CF] text-[#1A1C1C] hover:bg-white",
            )}
          >
            {n}
          </button>
        ))}

        {/* Next */}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="flex h-8 w-8 items-center justify-center rounded border border-[#C5C6CF] transition-colors hover:bg-white disabled:opacity-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
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
  onViewSequence,
  onRetry,
  page,
  pageSize,
  totalPages,
  total,
  onPageChange,
}: OverdueWorklistProps) {
  if (error) {
    return (
      <div className="overflow-hidden rounded-xl border border-[#C5C6CF] bg-white shadow-sm">
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
      <div className="overflow-hidden rounded-xl border border-[#C5C6CF] bg-white shadow-sm">
        <div className="space-y-2 p-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-[#F3F3F3]" />
          ))}
        </div>
      </div>
    );
  }

  if (rows.length === 0 && total === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-[#C5C6CF] bg-white shadow-sm">
        <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
          <span className="text-4xl">🎉</span>
          <p className="text-base font-semibold text-[#041534]">
            No overdue invoices
          </p>
          <p className="max-w-xs text-sm text-[#45464E]">
            All outstanding invoices are on time. Check back soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#C5C6CF] bg-white shadow-sm">
      {/* Mobile: card list */}
      <div className="flex flex-col md:hidden">
        {rows.map((row) => (
          <div
            key={row.id}
            className="border-b border-[#C5C6CF] last:border-b-0"
          >
            <button
              type="button"
              className="w-full text-left"
              onClick={() => onToggleExpand(row.id)}
            >
              {/* Left accent bar via box-shadow on the inner padding div */}
              <div
                className="p-4"
                style={{ boxShadow: `inset 3px 0 0 0 ${row.agingDotColor}` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-[#041534]">{row.customerName}</span>
                    <span className="text-[11px] leading-none text-[#45464E]">
                      {row.invoiceNumber} &bull; {row.dueDateShort}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        FOLLOW_UP_PILL[row.followUpStatus],
                      )}
                    >
                      {FOLLOW_UP_LABEL[row.followUpStatus]}
                    </span>
                    {expandedId === row.id ? (
                      <ChevronDown className="h-4 w-4 text-[#45464E]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[#45464E]" />
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-[#45464E]">Due {row.dueDate}</span>
                    <span className="text-sm font-bold tabular-nums text-[#BA1A1A]">
                      {row.balanceDue}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: row.agingDotColor }}
                    />
                    <span
                      className="text-[13px] font-medium tabular-nums"
                      style={{ color: row.agingDotColor }}
                    >
                      {row.daysOverdue} days
                    </span>
                  </div>
                </div>
                <div className="mt-3">
                  <ActionButton
                    status={row.followUpStatus}
                    row={row}
                    onStartFollowUp={onStartFollowUp}
                    onViewSequence={onViewSequence}
                  />
                </div>
              </div>
            </button>
            {expandedId === row.id && <ExpandedPanel row={row} />}
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      {/* Columns: chevron · Customer & Invoice · Days Overdue · Amount · Status · Action */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#C5C6CF] bg-[#F3F3F3]">
              <th className={cn(HEAD, "pl-6 w-8")} />
              <th className={HEAD}>Customer &amp; Invoice</th>
              <th className={HEAD}>Days Overdue</th>
              <th className={cn(HEAD, "text-right")}>Amount</th>
              <th className={HEAD}>Status</th>
              <th className={cn(HEAD, "pr-6")}>Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#C5C6CF]">
            {rows.map((row) => (
              <Fragment key={row.id}>
                <tr
                  onClick={() => onToggleExpand(row.id)}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-black/[0.02]",
                    expandedId === row.id && "bg-[#F9F9F9]",
                  )}
                >
                  {/* Expand chevron — carries the left accent bar via box-shadow */}
                  <td
                    className="py-3 pl-6 pr-2"
                    style={{ boxShadow: `inset 3px 0 0 0 ${row.agingDotColor}` }}
                  >
                    {expandedId === row.id ? (
                      <ChevronDown className="h-4 w-4 text-[#45464E]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[#45464E]" />
                    )}
                  </td>

                  {/* Customer & Invoice — combined column */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-[#041534]">{row.customerName}</span>
                      <span className="text-[11px] leading-none text-[#45464E]">
                        {row.invoiceNumber} &bull; {row.dueDateShort}
                      </span>
                    </div>
                  </td>

                  {/* Days Overdue — "{n} days" with aging dot, colored by aging scale */}
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: row.agingDotColor }}
                      />
                      <span
                        className="text-[13px] font-medium tabular-nums"
                        style={{ color: row.agingDotColor }}
                      >
                        {row.daysOverdue} days
                      </span>
                    </span>
                  </td>

                  {/* Amount — red, bold, tabular */}
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-[#BA1A1A]">
                    {row.balanceDue}
                  </td>

                  {/* Follow-up status pill */}
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        FOLLOW_UP_PILL[row.followUpStatus],
                      )}
                    >
                      {FOLLOW_UP_LABEL[row.followUpStatus]}
                    </span>
                  </td>

                  {/* Action button */}
                  <td className="px-4 py-3 pr-6">
                    <ActionButton
                      status={row.followUpStatus}
                      row={row}
                      onStartFollowUp={onStartFollowUp}
                      onViewSequence={onViewSequence}
                    />
                  </td>
                </tr>

                {expandedId === row.id && (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <ExpandedPanel row={row} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <PaginationFooter
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        total={total}
        onPageChange={onPageChange}
      />
    </div>
  );
}
