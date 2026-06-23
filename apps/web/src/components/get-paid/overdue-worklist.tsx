import { Fragment, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  History,
  ArrowRight,
  ReceiptText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "../../lib/utils";
import type { FollowUpStatus, OverdueRow } from "../../pages/get-paid/get-paid.view-model";

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

// ---- Status badge ----------------------------------------------------------
function StatusBadge({ status }: { status: FollowUpStatus }) {
  if (status === "active") {
    return (
      <Badge className="border-transparent bg-emerald-500/15 text-emerald-300">
        Active
      </Badge>
    );
  }
  if (status === "paused") {
    return (
      <Badge className="border-transparent bg-amber-500/15 text-amber-300">
        Paused
      </Badge>
    );
  }
  return <Badge variant="secondary">No sequence</Badge>;
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
      <Button
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onStartFollowUp(row);
        }}
      >
        Start follow-up
      </Button>
    );
  }
  if (status === "active") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          // Deep-linking to the specific sequence run is a follow-up TODO.
          onViewSequence();
        }}
      >
        View sequence
      </Button>
    );
  }
  // paused
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        // Deep-linking to the specific sequence run is a follow-up TODO.
        onViewSequence();
      }}
    >
      Resume
    </Button>
  );
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
    <div className="border-t bg-muted/50 px-6 py-5">
      <div className="grid items-stretch gap-4 md:grid-cols-3">
        {/* Card 1: Invoice Details */}
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-1.5">
            <ReceiptText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
              Invoice Details
            </span>
          </div>
          <div className="flex flex-col gap-1.5 text-sm">
            {row.issuedDate && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Issued</span>
                <span className="text-foreground">{row.issuedDate}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Due</span>
              <span className="text-muted-foreground">{row.dueDate}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Balance due</span>
              <span className="font-bold tabular-nums text-foreground">{row.balanceDue}</span>
            </div>
          </div>
          {row.paymentLinkUrl && (
            <Button
              variant="link"
              size="sm"
              className="mt-auto w-full justify-center gap-1.5"
              onClick={handleCopyLink}
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copied!" : "Copy payment link"}
            </Button>
          )}
        </div>

        {/* Card 2: Recent Activity */}
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-1.5">
            <History className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
              Recent Activity
            </span>
          </div>
          {/* DO NOT invent reminder events — show placeholder only */}
          <p className="text-sm text-muted-foreground">No activity yet</p>
        </div>

        {/* Card 3: Next Action */}
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-1.5">
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
              Next Action
            </span>
          </div>
          {/* Sequences editor doesn't exist yet — show placeholder only */}
          <p className="text-sm text-muted-foreground">No activity yet</p>
        </div>
      </div>
    </div>
  );
}

// ---- Pagination footer -----------------------------------------------------
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
    <div className="flex items-center justify-between border-t px-6 py-4">
      <span className="text-sm text-muted-foreground">
        Showing {from} to {to} of {total} entries
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {pageNumbers.map((n) => (
          <Button
            key={n}
            variant={n === page ? "default" : "outline"}
            size="icon-sm"
            onClick={() => onPageChange(n)}
            aria-label={`Page ${n}`}
            aria-current={n === page ? "page" : undefined}
          >
            {n}
          </Button>
        ))}

        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
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
      <Card>
        <CardContent className="px-6 py-12">
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load overdue invoices.{" "}
            <button
              type="button"
              onClick={onRetry}
              className="font-medium text-primary hover:underline"
            >
              Retry
            </button>
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-2 px-6 py-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0 && total === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 px-6 py-20 text-center">
          <span className="text-4xl">🎉</span>
          <p className="text-base font-semibold text-foreground">No overdue invoices</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            All outstanding invoices are on time. Check back soon.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-6 py-5 [.border-b]:pb-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Overdue invoices</CardTitle>
          <span className="text-sm text-muted-foreground">
            {total} {total === 1 ? "invoice" : "invoices"}
          </span>
        </div>
      </CardHeader>

      {/* Mobile: card list */}
      <div className="flex flex-col md:hidden">
        {rows.map((row) => (
          <div key={row.id} className="border-b last:border-b-0">
            <button
              type="button"
              className="w-full text-left"
              onClick={() => onToggleExpand(row.id)}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">{row.customerName}</span>
                    <span className="text-xs text-muted-foreground">
                      {row.invoiceNumber} &bull; Due {row.dueDateShort}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={row.followUpStatus} />
                    {expandedId === row.id ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: row.agingDotColor }}
                    />
                    <span className="text-xs tabular-nums" style={{ color: row.agingDotColor }}>
                      {row.daysOverdue} days
                    </span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-destructive">
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

      {/* Desktop: shadcn Table */}
      <CardContent className="hidden p-0 md:block">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead className="w-10" aria-label="Expand" />
              <TableHead>Customer</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Overdue</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <Fragment key={row.id}>
                <TableRow
                  onClick={() => onToggleExpand(row.id)}
                  className={cn(
                    "cursor-pointer",
                    row.isSevere && "border-l-2 border-l-destructive/40",
                    expandedId === row.id && "bg-muted/50",
                  )}
                >
                  {/* Expand chevron */}
                  <TableCell className="px-4">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground"
                      aria-label={expandedId === row.id ? "Collapse row" : "Expand row"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleExpand(row.id);
                      }}
                      tabIndex={-1}
                    >
                      {expandedId === row.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>

                  {/* Customer */}
                  <TableCell className="px-4 font-medium text-foreground">
                    {row.customerName}
                  </TableCell>

                  {/* Invoice # */}
                  <TableCell className="px-4 text-sm text-muted-foreground">
                    {row.invoiceNumber}
                  </TableCell>

                  {/* Due Date */}
                  <TableCell className="px-4 text-sm text-muted-foreground">
                    {row.dueDateShort}
                  </TableCell>

                  {/* Overdue — aging dot + colored text */}
                  <TableCell className="px-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: row.agingDotColor }}
                      />
                      <span className="text-sm tabular-nums" style={{ color: row.agingDotColor }}>
                        {row.daysOverdue} days
                      </span>
                    </span>
                  </TableCell>

                  {/* Amount — red, semibold, right-aligned */}
                  <TableCell className="px-4 text-right font-semibold tabular-nums text-destructive">
                    {row.balanceDue}
                  </TableCell>

                  {/* Status badge */}
                  <TableCell className="px-4">
                    <StatusBadge status={row.followUpStatus} />
                  </TableCell>

                  {/* Action button */}
                  <TableCell className="px-4">
                    <ActionButton
                      status={row.followUpStatus}
                      row={row}
                      onStartFollowUp={onStartFollowUp}
                      onViewSequence={onViewSequence}
                    />
                  </TableCell>
                </TableRow>

                {expandedId === row.id && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={8} className="p-0">
                      <ExpandedPanel row={row} />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {/* Pagination footer */}
      <PaginationFooter
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        total={total}
        onPageChange={onPageChange}
      />
    </Card>
  );
}
