import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AttentionRow } from "../../pages/dashboard/dashboard.view-model";

interface NeedsAttentionTableProps {
  rows: AttentionRow[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  onViewAll: () => void;
}

export function NeedsAttentionTable({
  rows,
  isLoading,
  error,
  onRetry,
  onViewAll,
}: NeedsAttentionTableProps) {
  return (
    <Card className="card-lift gap-0 py-0">
      <CardHeader className="border-b px-6 py-5 [.border-b]:pb-6">
        <CardTitle className="text-base font-semibold">Needs your attention</CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        {error ? (
          <p className="px-6 py-10 text-sm text-muted-foreground">
            Couldn&apos;t load attention items.{" "}
            <Button variant="link" size="sm" className="h-auto p-0" onClick={onRetry}>
              Retry
            </Button>
          </p>
        ) : isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            Nothing needs your attention right now. 🎉
          </p>
        ) : (
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="border-0 hover:bg-transparent">
                <TableHead className="px-6">Customer</TableHead>
                <TableHead className="px-6">Invoice</TableHead>
                <TableHead className="px-6 text-right">Amount</TableHead>
                <TableHead className="px-6 text-center">Overdue</TableHead>
                <TableHead className="px-6">What happened</TableHead>
                <TableHead className="px-6">Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="px-6 font-medium text-foreground">
                    {row.customerName}
                  </TableCell>
                  <TableCell className="px-6 text-muted-foreground">
                    {row.invoiceNumber}
                  </TableCell>
                  <TableCell className="px-6 text-right font-semibold text-foreground">
                    {row.amount}
                  </TableCell>
                  <TableCell className="px-6 text-center font-semibold text-destructive">
                    {row.daysOverdue}d
                  </TableCell>
                  <TableCell className="max-w-[180px] px-6 text-xs italic text-muted-foreground">
                    {row.summary}
                  </TableCell>
                  <TableCell className="px-6">
                    <Badge
                      variant="secondary"
                      className={row.badge.className}
                    >
                      {row.badge.label}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {!isLoading && !error && rows.length > 0 && (
        <div className="border-t bg-muted/20 p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewAll}
            className="w-full text-xs font-bold uppercase tracking-widest text-primary"
          >
            View all attention items
          </Button>
        </div>
      )}
    </Card>
  );
}
