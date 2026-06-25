import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SequenceRow } from "@/pages/sequences/sequences.view-model";

interface SequenceTableProps {
  rows: SequenceRow[];
  isLoading: boolean;
  error: string | null;
  onRequestDelete: (r: SequenceRow) => void;
}

export function SequenceTable({
  rows,
  isLoading,
  error,
  onRequestDelete,
}: SequenceTableProps) {
  if (isLoading) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Loading sequences…
      </p>
    );
  }

  if (error) {
    return (
      <p className="py-8 text-center text-sm text-destructive">{error}</p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No sequences found.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Steps</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Running</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <span className="font-medium">{r.name}</span>
              <span className="block text-xs text-muted-foreground">{r.tierName}</span>
            </TableCell>
            <TableCell>{r.stepCountLabel}</TableCell>
            <TableCell>
              {r.isActive ? (
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                >
                  Active
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Paused
                </Badge>
              )}
            </TableCell>
            <TableCell>
              <span className={cn(r.activeRuns === 0 && "text-muted-foreground")}>
                {r.activeRuns}
              </span>
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete sequence"
                onClick={() => onRequestDelete(r)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
