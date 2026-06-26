import { Trash2, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ListCard,
  ListCardHeader,
  ListMessageCard,
  ListRow,
  ListSkeletonCard,
} from "@/components/common/list-card";
import { cn } from "@/lib/utils";
import type { SequenceRow } from "@/pages/sequences/sequences.view-model";

interface SequenceListProps {
  rows: SequenceRow[];
  isLoading: boolean;
  error: string | null;
  onRequestDelete: (r: SequenceRow) => void;
  onOpen?: (id: string) => void;
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
  onOpen,
}: SequenceListProps) {
  if (error) {
    return (
      <ListMessageCard>
        <p className="text-sm text-destructive">{error}</p>
      </ListMessageCard>
    );
  }

  if (isLoading) {
    return <ListSkeletonCard />;
  }

  if (rows.length === 0) {
    return (
      <ListMessageCard className="flex flex-col items-center gap-4 py-16 text-center">
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
      </ListMessageCard>
    );
  }

  return (
    <ListCard>
      <ListCardHeader label="All sequences" count={rows.length} noun="sequence" />
      <TooltipProvider>
        {rows.map((row) => (
          <ListRow
            key={row.id}
            onClick={() => onOpen?.(row.id)}
            icon={<Workflow className="h-4 w-4" />}
            title={row.name}
            subtitle={`${row.tierName} · ${row.stepCountLabel}`}
            right={
              <>
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span onClick={(e) => e.stopPropagation()} className="inline-flex">
                        <Button
                          variant="outline"
                          size="icon-sm"
                          aria-label="Delete sequence"
                          disabled={row.inUse}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRequestDelete(row);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {row.inUse && (
                      <TooltipContent side="top">{row.deleteBlockedReason}</TooltipContent>
                    )}
                  </Tooltip>
                </div>
              </>
            }
          />
        ))}
      </TooltipProvider>
    </ListCard>
  );
}
