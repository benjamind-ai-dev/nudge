import { Mail, Pencil, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      <Card>
        <CardContent className="px-6 py-12">
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
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center justify-between border-b px-[18px] py-[14px]">
        <span className="text-sm font-semibold text-foreground">All templates</span>
        <span className="text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? "template" : "templates"}
        </span>
      </div>
      <div className="flex flex-col">
        {rows.map((row) => (
          <div
            key={row.id}
            onClick={() => onEdit(row.id)}
            className="group flex cursor-pointer items-center gap-3.5 border-b px-[18px] py-[15px] last:border-b-0 hover:bg-accent/40"
          >
            <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[9px] bg-accent text-accent-foreground">
              <Mail className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground">{row.name}</div>
              <div className="truncate text-[12.5px] text-muted-foreground">
                {row.subjectPreview}
              </div>
            </div>
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
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete({ id: row.id, name: row.name });
                }}
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
