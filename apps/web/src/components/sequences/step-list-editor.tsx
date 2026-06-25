import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { StepTemplatePicker } from "./step-template-picker";
import type { DraftStep } from "@/pages/sequences/[id]/sequence-editor.view-model";
import type { TemplateListItem } from "@/api/templates.api";

const CHANNEL_OPTIONS: { label: string; value: DraftStep["channel"] }[] = [
  { label: "Email", value: "email" },
  { label: "SMS", value: "sms" },
  { label: "Both", value: "email_and_sms" },
];

const MAX_STEPS = 10;

interface StepListEditorProps {
  steps: DraftStep[];
  templates: TemplateListItem[];
  hasNoTemplates: boolean;
  onAdd: () => void;
  onRemove: (key: string) => void;
  onMove: (key: string, dir: "up" | "down") => void;
  onTemplate: (key: string, id: string) => void;
  onChannel: (key: string, c: DraftStep["channel"]) => void;
  onDelay: (key: string, days: number) => void;
  onToggleOwnerAlert: (key: string) => void;
  onTogglePaymentLink: (key: string) => void;
  onSms: (key: string, body: string) => void;
}

export function StepListEditor({
  steps,
  templates,
  hasNoTemplates,
  onAdd,
  onRemove,
  onMove,
  onTemplate,
  onChannel,
  onDelay,
  onToggleOwnerAlert,
  onTogglePaymentLink,
  onSms,
}: StepListEditorProps) {
  const atCap = steps.length >= MAX_STEPS;

  return (
    <div className="flex flex-col gap-3">
      {steps.map((step, index) => {
        const isFirst = index === 0;
        const isLast = index === steps.length - 1;

        return (
          <Card key={step.key} className="gap-0 py-0">
            <CardContent className="flex flex-col gap-4 px-5 py-4">
              {/* Header row: index badge + remove */}
              <div className="flex items-center justify-between">
                <span className="flex h-6 w-14 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  Step {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove step"
                  onClick={() => onRemove(step.key)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              {/* Template picker */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Template</Label>
                <StepTemplatePicker
                  value={step.templateId}
                  templates={templates}
                  hasNoTemplates={hasNoTemplates}
                  onChange={(id) => onTemplate(step.key, id)}
                />
              </div>

              {/* Channel control */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Channel</Label>
                <div className="flex gap-1">
                  {CHANNEL_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      size="sm"
                      variant={step.channel === opt.value ? "default" : "outline"}
                      onClick={() => onChannel(step.key, opt.value)}
                      className={cn(
                        "flex-1 text-xs",
                        step.channel === opt.value && "shadow-none",
                      )}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Delay */}
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor={`delay-${step.key}`}
                  className="text-xs font-medium text-muted-foreground"
                >
                  Send after (days)
                </Label>
                <Input
                  id={`delay-${step.key}`}
                  type="number"
                  min={0}
                  value={step.delayDays === 0 ? "" : step.delayDays}
                  placeholder="0"
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    onDelay(step.key, Number.isNaN(n) ? 0 : n);
                  }}
                  className="w-28"
                />
                {isFirst && (
                  <p className="text-xs text-muted-foreground">0 = when follow-up starts</p>
                )}
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-5">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`owner-alert-${step.key}`}
                    checked={step.isOwnerAlert}
                    onCheckedChange={() => onToggleOwnerAlert(step.key)}
                    size="sm"
                  />
                  <Label
                    htmlFor={`owner-alert-${step.key}`}
                    className="cursor-pointer text-sm"
                  >
                    Owner alert
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id={`payment-link-${step.key}`}
                    checked={step.includePaymentLink}
                    onCheckedChange={() => onTogglePaymentLink(step.key)}
                    size="sm"
                  />
                  <Label
                    htmlFor={`payment-link-${step.key}`}
                    className="cursor-pointer text-sm"
                  >
                    Payment link
                  </Label>
                </div>
              </div>

              {/* SMS body — only when channel includes SMS */}
              {step.channel !== "email" && (
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor={`sms-${step.key}`}
                    className="text-xs font-medium text-muted-foreground"
                  >
                    SMS body
                  </Label>
                  <Textarea
                    id={`sms-${step.key}`}
                    value={step.smsBodyTemplate}
                    onChange={(e) => onSms(step.key, e.target.value)}
                    placeholder="Enter SMS message…"
                    rows={3}
                  />
                </div>
              )}

              {/* Footer: move up / move down */}
              <div className="flex gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isFirst}
                  onClick={() => onMove(step.key, "up")}
                  className="gap-1.5 text-xs"
                >
                  <ArrowUp className="size-3" />
                  Move up
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isLast}
                  onClick={() => onMove(step.key, "down")}
                  className="gap-1.5 text-xs"
                >
                  <ArrowDown className="size-3" />
                  Move down
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Add step */}
      <div className="flex flex-col gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={atCap}
          onClick={onAdd}
          className="w-full gap-2"
        >
          <Plus className="size-4" />
          Add step
        </Button>
        {atCap && (
          <p className="text-center text-xs text-muted-foreground">
            Maximum of {MAX_STEPS} steps reached.
          </p>
        )}
      </div>
    </div>
  );
}
