import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface TemplateEditorFormProps {
  name: string;
  subject: string;
  body: string;
  signature: string;
  onNameChange: (v: string) => void;
  onSubjectChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onSignatureChange: (v: string) => void;
  aiDescription: string;
  onAiDescriptionChange: (v: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

const VARIABLES = [
  "contact_name",
  "company_name",
  "invoice_number",
  "amount",
  "balance_due",
  "due_date",
  "days_overdue",
  "payment_link",
];

export function TemplateEditorForm({
  name,
  subject,
  body,
  signature,
  onNameChange,
  onSubjectChange,
  onBodyChange,
  onSignatureChange,
  aiDescription,
  onAiDescriptionChange,
  onGenerate,
  isGenerating,
}: TemplateEditorFormProps) {
  return (
    <div className="rounded-[10px] border bg-card">
      <div className="flex items-center justify-between border-b px-[18px] py-[14px]">
        <span className="text-sm font-semibold text-foreground">Compose</span>
      </div>
      <div className="space-y-4 p-[18px]">
        {/* AI draft bar */}
        <div className="flex items-center gap-2 rounded-[10px] border border-indigo-200 bg-indigo-50/60 p-2.5 dark:border-indigo-500/30 dark:bg-indigo-500/10">
          <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] bg-primary text-primary-foreground">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <input
            value={aiDescription}
            onChange={(e) => onAiDescriptionChange(e.target.value)}
            placeholder="Describe the email you want — e.g. a polite first reminder"
            className="flex-1 bg-transparent text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          <Button
            size="sm"
            onClick={onGenerate}
            disabled={isGenerating || !aiDescription.trim()}
          >
            {isGenerating ? "Drafting…" : "Draft"}
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tpl-name">Template name</Label>
          <Input
            id="tpl-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Friendly reminder"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tpl-subject">Subject</Label>
          <Input
            id="tpl-subject"
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            placeholder="Invoice {{invoice_number}} — a quick reminder"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tpl-body">Body</Label>
          <Textarea
            id="tpl-body"
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            rows={9}
            className="resize-none"
            placeholder="Hi {{contact_name}}, …  (HTML allowed)"
          />
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] text-muted-foreground">Variables:</span>
            {VARIABLES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onBodyChange(`${body}{{${v}}}`)}
                className="rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tpl-sig">Signature</Label>
          <Textarea
            id="tpl-sig"
            value={signature}
            onChange={(e) => onSignatureChange(e.target.value)}
            rows={3}
            className="resize-none"
            placeholder={"Thanks,\nSarah · Acme Books  (HTML allowed)"}
          />
        </div>
      </div>
    </div>
  );
}
