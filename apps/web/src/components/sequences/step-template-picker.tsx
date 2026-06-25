import { Link } from "react-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TemplateListItem } from "@/api/templates.api";

interface StepTemplatePickerProps {
  value: string | null;
  templates: TemplateListItem[];
  hasNoTemplates: boolean;
  onChange: (templateId: string) => void;
}

export function StepTemplatePicker({
  value,
  templates,
  hasNoTemplates,
  onChange,
}: StepTemplatePickerProps) {
  if (hasNoTemplates) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
        <span>No templates yet.</span>
        <Link
          to="/templates/new"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Create a template first
        </Link>
      </div>
    );
  }

  const selected = value ? templates.find((t) => t.id === value) : null;

  return (
    <div className="flex flex-col gap-1">
      <Select value={value ?? undefined} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a template…" />
        </SelectTrigger>
        <SelectContent>
          {templates.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected?.subject && (
        <p className="truncate text-xs text-muted-foreground">
          Subject: {selected.subject}
        </p>
      )}
    </div>
  );
}
