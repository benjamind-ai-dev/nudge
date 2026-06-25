import { Mail, Pencil, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { TemplateRow } from "../../pages/templates/templates.view-model";

interface TemplateListProps {
  rows: TemplateRow[];
  isLoading: boolean;
  error: unknown;
  onNew: () => void;
  onDraftWithAI: () => void;
  onEdit: (id: string) => void;
  onDelete: (t: { id: string; name: string }) => void;
  onRetry: () => void;
}

export function TemplateList({
  rows,
  isLoading,
  error,
  onNew,
  onDraftWithAI,
  onEdit,
  onDelete,
  onRetry,
}: TemplateListProps) {
  if (error) {
    return (
      <ListMessageCard>
        <p className="text-sm text-muted-foreground">
          Couldn't load templates.{" "}
          <button
            type="button"
            onClick={onRetry}
            className="font-medium text-primary hover:underline"
          >
            Retry
          </button>
        </p>
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
          <Mail className="h-6 w-6" />
        </span>
        <div>
          <p className="text-base font-semibold text-foreground">No templates yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Create reusable emails once, then reuse them across your follow-up sequences and
            customers.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onDraftWithAI}>
            <Sparkles className="mr-1.5 h-4 w-4" />
            Draft with AI
          </Button>
          <Button onClick={onNew}>+ New template</Button>
        </div>
      </ListMessageCard>
    );
  }

  return (
    <ListCard>
      <ListCardHeader label="All templates" count={rows.length} noun="template" />
      <TooltipProvider>
        {rows.map((row) => (
          <ListRow
            key={row.id}
            onClick={() => onEdit(row.id)}
            icon={<Mail className="h-4 w-4" />}
            title={row.name}
            subtitle={row.subjectPreview}
            right={
              <>
                <span className="shrink-0 text-xs text-muted-foreground group-hover:hidden">
                  {row.updatedLabel}
                </span>
                <div className="hidden shrink-0 gap-1 group-hover:flex">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(row.id);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span onClick={(e) => e.stopPropagation()} className="inline-flex">
                        <Button
                          variant="outline"
                          size="icon-sm"
                          aria-label="Delete"
                          disabled={row.inUse}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete({ id: row.id, name: row.name });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {row.inUse && (
                      <TooltipContent side="top">
                        In use by a sequence or customer — detach it first to delete.
                      </TooltipContent>
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
