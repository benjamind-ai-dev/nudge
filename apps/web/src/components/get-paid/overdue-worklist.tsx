import { Fragment, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  History,
  ArrowRight,
  ReceiptText,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type { FollowUpStatus, OverdueRow } from "../../pages/get-paid/get-paid.view-model";

// ---- Column header style (matches needs-attention-table) -------------------
const HEAD =
  "px-6 py-4 text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]";

// ---- Card section label style ----------------------------------------------
const CARD_LABEL =
  "text-[10px] font-semibold uppercase tracking-[0.07em] text-[#64748B]";

// ---- Follow-up status pill -------------------------------------------------
const FOLLOW_UP_PILL: Record<FollowUpStatus, string> = {
  none: "bg-[#F1F5F9] text-[#64748B]",
  active: "bg-[#D1FAE5] text-[#059669]",
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

// ---- Expanded panel --------------------------------------------------------
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
    <div className="border-t border-[#E2E8F0] bg-[rgba(243,243,243,0.5)] px-6 py-5">
      <div className="grid items-stretch gap-4 md:grid-cols-3">
        {/* Card 1: Invoice Details */}
        <div className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-1.5">
            <ReceiptText className="h-3.5 w-3.5 text-[#64748B]" aria-hidden="true" />
            <span className={CARD_LABEL}>Invoice Details</span>
          </div>
          <div className="flex flex-col gap-1.5 text-sm">
            {row.issuedDate && (
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Issued</span>
                <span className="text-[#0F172A]">{row.issuedDate}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[#64748B]">Due</span>
              <span className="text-[#64748B]">{row.dueDate}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#64748B]">Balance due</span>
              <span className="font-bold tabular-nums text-[#0F172A]">{row.balanceDue}</span>
            </div>
          </div>
          {row.paymentLinkUrl && (
            <button
              type="button"
              onClick={handleCopyLink}
              className="mt-auto flex w-full items-center justify-center gap-1.5 rounded-md border border-[#E2E8F0] px-3 py-2 text-xs font-medium text-[#64748B] transition-colors hover:bg-[#F1F5F9]"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copied!" : "Copy payment link"}
            </button>
          )}
        </div>

        {/* Card 2: Recent Activity */}
        <div className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-1.5">
            <History className="h-3.5 w-3.5 text-[#64748B]" aria-hidden="true" />
            <span className={CARD_LABEL}>Recent Activity</span>
          </div>
          {/* DO NOT invent reminder events — show placeholder only */}
          <p className="text-sm text-[#64748B]">No activity yet</p>
        </div>

        {/* Card 3: Next Action */}
        <div className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-1.5">
            <ArrowRight className="h-3.5 w-3.5 text-[#64748B]" aria-hidden="true" />
            <span className={CARD_LABEL}>Next Action</span>
          </div>
          {/* Sequences editor doesn't exist yet — show placeholder only */}
          <p className="text-sm text-[#64748B]">No activity yet</p>
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
        className="flex h-9 items-center gap-2 rounded-lg bg-[#2563EB] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]"
      >
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
        className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-[#0F172A] transition-colors hover:bg-gray-50"
      >
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
      className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-[#0F172A] transition-colors hover:bg-gray-50"
    >
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

  const pageNumbers: number[] = [];
  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="flex items-center justify-between border-t border-[#E2E8F0] px-6 py-4">
      <span className="text-sm text-[#64748B]">
        Showing {from} to {to} of {total} entries
      </span>
      <div className="flex items-center gap-1">
        {/* Prev */}
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] text-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
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
              "h-8 min-w-[2rem] rounded-lg border px-2 text-sm font-medium transition-colors",
              n === page
                ? "border-[#2563EB] bg-[#2563EB] text-white"
                : "border-[#E2E8F0] text-[#0F172A] hover:bg-gray-50",
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
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] text-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
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
      <section className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        <p className="px-6 py-12 text-sm text-[#64748B]">
          Couldn&apos;t load overdue invoices.{" "}
          <button
            type="button"
            onClick={onRetry}
            className="font-medium text-[#2563EB] hover:underline"
          >
            Retry
          </button>
        </p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        <div className="space-y-2 p-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-gray-50" />
          ))}
        </div>
      </section>
    );
  }

  if (rows.length === 0 && total === 0) {
    return (
      <section className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
          <span className="text-4xl">🎉</span>
          <p className="text-base font-semibold text-[#0F172A]">
            No overdue invoices
          </p>
          <p className="max-w-xs text-sm text-[#64748B]">
            All outstanding invoices are on time. Check back soon.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
      {/* Section header row */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-5">
        <h3 className="text-lg font-semibold tracking-[-0.01em] text-[#0F172A]">
          Overdue invoices
        </h3>
        <span className="text-sm text-[#64748B]">
          {total} {total === 1 ? "invoice" : "invoices"}
        </span>
      </div>

      {/* Mobile: card list */}
      <div className="flex flex-col md:hidden">
        {rows.map((row) => (
          <div
            key={row.id}
            className="border-b border-[#E2E8F0] last:border-b-0"
          >
            <button
              type="button"
              className="w-full text-left"
              onClick={() => onToggleExpand(row.id)}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-[#0F172A]">{row.customerName}</span>
                    <span className="text-xs text-[#64748B]">
                      {row.invoiceNumber} &bull; Due {row.dueDateShort}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        "inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                        FOLLOW_UP_PILL[row.followUpStatus],
                      )}
                    >
                      {FOLLOW_UP_LABEL[row.followUpStatus]}
                    </span>
                    {expandedId === row.id ? (
                      <ChevronDown className="h-4 w-4 text-[#64748B]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[#64748B]" />
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: row.agingDotColor }}
                    />
                    <span
                      className="text-xs font-semibold tabular-nums"
                      style={{ color: row.agingDotColor }}
                    >
                      {row.daysOverdue}d overdue
                    </span>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-[#DC2626]">
                    {row.balanceDue}
                  </span>
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
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[800px] border-collapse text-left">
          <thead className="bg-[rgba(243,243,243,0.5)]">
            <tr>
              <th className={cn(HEAD, "w-10")} aria-label="Expand" />
              <th className={cn(HEAD, "text-left")}>Customer</th>
              <th className={cn(HEAD, "text-left")}>Invoice #</th>
              <th className={cn(HEAD, "text-left")}>Due Date</th>
              <th className={cn(HEAD, "text-left")}>Overdue</th>
              <th className={cn(HEAD, "text-right")}>Amount</th>
              <th className={cn(HEAD, "text-left")}>Status</th>
              <th className={cn(HEAD, "text-left")}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Fragment key={row.id}>
                <tr
                  onClick={() => onToggleExpand(row.id)}
                  className={cn(
                    "cursor-pointer border-t border-[#E2E8F0] transition-colors hover:bg-black/[0.02]",
                    expandedId === row.id && "bg-[rgba(243,243,243,0.5)]",
                  )}
                >
                  {/* Expand chevron */}
                  <td className="px-6 py-4 text-[#64748B]">
                    {expandedId === row.id ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </td>

                  {/* Customer */}
                  <td className="px-6 py-4 text-sm font-medium text-[#0F172A]">
                    {row.customerName}
                  </td>

                  {/* Invoice # */}
                  <td className="px-6 py-4 text-xs text-[#64748B]">
                    {row.invoiceNumber}
                  </td>

                  {/* Due Date */}
                  <td className="px-6 py-4 text-xs text-[#64748B]">
                    {row.dueDateShort}
                  </td>

                  {/* Overdue — aging dot + colored text */}
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: row.agingDotColor }}
                      />
                      <span
                        className="text-xs font-semibold tabular-nums"
                        style={{ color: row.agingDotColor }}
                      >
                        {row.daysOverdue}d
                      </span>
                    </span>
                  </td>

                  {/* Amount — red, bold, right-aligned */}
                  <td className="px-6 py-4 text-right text-sm font-bold tabular-nums text-[#DC2626]">
                    {row.balanceDue}
                  </td>

                  {/* Status pill */}
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        "inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                        FOLLOW_UP_PILL[row.followUpStatus],
                      )}
                    >
                      {FOLLOW_UP_LABEL[row.followUpStatus]}
                    </span>
                  </td>

                  {/* Action button */}
                  <td className="px-6 py-4">
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
                    <td colSpan={8} className="p-0">
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
    </section>
  );
}
