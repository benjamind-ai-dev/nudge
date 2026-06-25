import { Trash2, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SequenceRow } from "@/pages/sequences/sequences.view-model";

interface SequenceListProps {
  rows: SequenceRow[];
  isLoading: boolean;
  error: string | null;
  onRequestDelete: (r: SequenceRow) => void;
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
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
  );
}

export function SequenceList({
  rows,
  isLoading,
  error,
  onRequestDelete,
}: SequenceListProps) {
  if (error) {
    return (
      <Card>
        <CardContent className="px-6 py-12">
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-2 px-6 py-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <Workflow className="h-6 w-6" />
          </span>
          <div>
            <p className="text-base font-semibold text-foreground">No sequences found</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Sequences are the follow-up flows that chase your overdue invoices — a series of
              timed emails, each using one of your templates.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center justify-between border-b px-[18px] py-[14px]">
        <span className="text-sm font-semibold text-foreground">All sequences</span>
        <span className="text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? "sequence" : "sequences"}
        </span>
      </div>
      <div className="flex flex-col">
        {rows.map((row) => (
          <div
            key={row.id}
            className="group flex items-center gap-3.5 border-b px-[18px] py-[15px] last:border-b-0 hover:bg-accent/40"
          >
            <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[9px] bg-accent text-accent-foreground">
              <Workflow className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground">{row.name}</div>
              <div className="truncate text-[12.5px] text-muted-foreground">
                {row.tierName} · {row.stepCountLabel}
              </div>
            </div>
            <StatusBadge isActive={row.isActive} />
            <span
              className={cn(
                "w-24 shrink-0 text-right text-[12.5px] text-muted-foreground group-hover:hidden",
                row.activeRuns === 0 && "opacity-60",
              )}
            >
              {row.activeRuns} running
            </span>
            <div className="hidden w-24 shrink-0 justify-end group-hover:flex">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Delete sequence"
                onClick={() => onRequestDelete(row)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
