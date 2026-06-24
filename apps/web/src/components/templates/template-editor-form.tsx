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
  nameError?: string;
  subjectError?: string;
  bodyError?: string;
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
  nameError,
  subjectError,
  bodyError,
}: TemplateEditorFormProps) {
  return (
    <div className="rounded-[10px] border bg-card">
      <div className="flex items-center justify-between border-b px-[18px] py-[14px]">
        <span className="text-sm font-semibold text-foreground">Compose</span>
      </div>
      <div className="space-y-4 p-[18px]">
        <div className="space-y-1.5">
          <Label htmlFor="tpl-name">
            Template name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="tpl-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Friendly reminder"
            aria-invalid={Boolean(nameError)}
            className={nameError ? "border-destructive focus-visible:ring-destructive/40" : undefined}
          />
          {nameError && <p className="text-xs text-destructive">{nameError}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tpl-subject">
            Subject <span className="text-destructive">*</span>
          </Label>
          <Input
            id="tpl-subject"
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            placeholder="Invoice {{invoice_number}} — a quick reminder"
            aria-invalid={Boolean(subjectError)}
            className={subjectError ? "border-destructive focus-visible:ring-destructive/40" : undefined}
          />
          {subjectError && <p className="text-xs text-destructive">{subjectError}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tpl-body">
            Body <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="tpl-body"
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            rows={9}
            aria-invalid={Boolean(bodyError)}
            className={bodyError ? "resize-none border-destructive focus-visible:ring-destructive/40" : "resize-none"}
            placeholder="Hi {{contact_name}}, …  (HTML allowed)"
          />
          {bodyError && <p className="text-xs text-destructive">{bodyError}</p>}
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
