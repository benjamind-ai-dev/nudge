import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    <Card className="gap-0 py-0 overflow-hidden">
      {error ? (
        <CardContent className="px-6 py-12">
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load invoices.{" "}
            <button
              type="button"
              onClick={onRetry}
              className="font-medium text-primary hover:underline"
            >
              Retry
            </button>
          </p>
        </CardContent>
      ) : isLoading ? (
        <CardContent className="space-y-2 px-6 py-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </CardContent>
      ) : rows.length === 0 ? (
        <CardContent className="px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No invoices match these filters. 🎉
          </p>
        </CardContent>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col md:hidden">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-3 border-b p-4 last:border-b-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="font-bold text-foreground">{row.customerName}</span>
                    <span className="text-[11px] text-muted-foreground">
                      Invoice {row.invoiceNumber}
                    </span>
                  </div>
                  <Badge className={cn(row.statusClass)}>{row.statusLabel}</Badge>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="mb-1 text-[11px] text-muted-foreground">
                      Due {row.dueDate}
                    </span>
                    <span className="text-lg font-extrabold text-foreground">
                      {row.amount}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase",
                        row.isOverdue ? "text-destructive" : "text-emerald-700",
                      )}
                    >
                      {row.isOverdue ? `${row.overdueLabel} late` : "On time"}
                    </span>
                    <Badge className={cn(row.bucketClass)}>{row.bucketLabel}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: shadcn Table */}
          <CardContent className="hidden p-0 md:block">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-0 hover:bg-transparent">
                  <TableHead className="pl-6 text-[11px] font-semibold uppercase tracking-[0.05em]">Customer</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-[0.05em]">Invoice #</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-[0.05em]">Due Date</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.05em]">Amount</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.05em]">Balance Due</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-[0.05em]">Overdue</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-[0.05em]">Bucket</TableHead>
                  <TableHead className="pr-6 text-[11px] font-semibold uppercase tracking-[0.05em]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="pl-6 font-semibold text-foreground">
                      {row.customerName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.invoiceNumber}</TableCell>
                    <TableCell className="text-foreground">{row.dueDate}</TableCell>
                    <TableCell className="text-right text-foreground">
                      {row.amount}
                    </TableCell>
                    <TableCell className="text-right font-bold text-destructive">
                      {row.balanceDue}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "font-medium",
                        row.isOverdue ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {row.overdueLabel}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(row.bucketClass)}>
                        {row.bucketLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-6">
                      <Badge className={cn(row.statusClass)}>
                        {row.statusLabel}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </>
      )}

      {!isLoading && !error && filteredTotal > 0 && (
        <div className="flex items-center justify-between border-t bg-muted/50 px-6 py-4">
          <span className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1} to{" "}
            {Math.min(page * pageSize, filteredTotal)} of {filteredTotal} invoices
            {isLoadingMore && " (loading more…)"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-sm font-medium text-foreground">
              {page} / {totalPages}
            </span>
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
      )}
    </Card>
  );
}
