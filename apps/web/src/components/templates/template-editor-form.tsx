import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VariableTextarea } from "./variable-textarea";

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
          <VariableTextarea
            id="tpl-body"
            value={body}
            onChange={onBodyChange}
            variables={VARIABLES}
            rows={9}
            placeholder="Hi {{contact_name}}, …  (HTML allowed)"
            aria-invalid={Boolean(bodyError)}
            className={bodyError ? "border-destructive focus-visible:ring-destructive/40" : undefined}
          />
          {bodyError && <p className="text-xs text-destructive">{bodyError}</p>}
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
