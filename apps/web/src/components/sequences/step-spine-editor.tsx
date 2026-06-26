import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { StepTemplatePicker } from "@/components/sequences/step-template-picker";
import type { DraftStep } from "@/pages/sequences/[id]/sequence-editor.view-model";
import type { TemplateListItem } from "@/api/templates.api";

const MAX_STEPS = 10;

const CHANNEL_OPTIONS: { label: string; value: DraftStep["channel"] }[] = [
  { label: "✉ Email", value: "email" },
  { label: "💬 SMS", value: "sms" },
  { label: "Both", value: "email_and_sms" },
];

function channelLabel(c: DraftStep["channel"]): string {
  if (c === "email") return "✉ Email";
  if (c === "sms") return "SMS";
  return "Both";
}

function channelChipClass(c: DraftStep["channel"]): string {
  if (c === "sms") {
    return "text-sky-300 bg-sky-500/10 border border-sky-500/30";
  }
  return "text-indigo-200 bg-indigo-500/10 border border-indigo-500/30";
}

interface StepSpineEditorProps {
  rows: {
    step: DraftStep;
    index: number;
    displayDay: number;
    isActive: boolean;
    isComplete: boolean;
  }[];
  templates: TemplateListItem[];
  hasNoTemplates: boolean;
  onAdd: () => void;
  onEdit: (key: string) => void;
  onDone: () => void;
  onRemove: (key: string) => void;
  onTemplate: (key: string, id: string) => void;
  onChannel: (key: string, c: DraftStep["channel"]) => void;
  onDelay: (key: string, days: number) => void;
  onToggleOwnerAlert: (key: string) => void;
  onTogglePaymentLink: (key: string) => void;
}

export function StepSpineEditor({
  rows,
  templates,
  hasNoTemplates,
  onAdd,
  onEdit,
  onDone,
  onRemove,
  onTemplate,
  onChannel,
  onDelay,
  onToggleOwnerAlert,
  onTogglePaymentLink,
}: StepSpineEditorProps) {
  const atCap = rows.length >= MAX_STEPS;

  return (
    <div className="relative pl-[46px]">
      {/* Spine rail — soft, muted (toned down from the bright gradient/glow) */}
      <div
        className="absolute left-[17px] top-2 bottom-[34px] w-[2px] rounded-full"
        style={{
          background:
            "linear-gradient(180deg, rgba(99,102,241,0.45), rgba(99,102,241,0.15))",
        }}
      />

      {rows.map((row, i) => {
        const nextRow = rows[i + 1];

        return (
          <div key={row.step.key}>
            {/* Step node */}
            <div className="relative mb-3.5">
              {/* Node dot */}
              <div
                className={cn(
                  "absolute -left-[37px] top-3.5 z-10 flex h-[30px] w-[30px] items-center justify-center rounded-[9px] border-2 text-xs font-semibold",
                  row.isComplete
                    ? "border-indigo-500 bg-indigo-500 text-white"
                    : "border-indigo-500 bg-secondary text-indigo-400",
                )}
              >
                {row.isComplete ? "✓" : row.index + 1}
              </div>

              {/* Collapsed card */}
              {!row.isActive && (
                <button
                  type="button"
                  onClick={() => onEdit(row.step.key)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-[10px] border border-border bg-card px-4 py-3 text-left transition-colors hover:border-indigo-500/40"
                >
                  <span className="w-[54px] shrink-0 text-[11px] font-semibold uppercase tracking-[.05em] text-muted-foreground">
                    Day {row.displayDay}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-foreground">
                    ▤ {row.step.templateName || "No template"}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-[6px] px-2 py-0.5 text-[10.5px] font-semibold",
                      channelChipClass(row.step.channel),
                    )}
                  >
                    {channelLabel(row.step.channel)}
                  </span>
                  <span className="shrink-0 text-[11.5px] text-muted-foreground">edit</span>
                </button>
              )}

              {/* Active expanded card */}
              {row.isActive && (
                <div
                  className="overflow-hidden rounded-[10px] border border-indigo-500/50 bg-card"
                  style={{
                    boxShadow: "0 1px 3px rgba(0,0,0,.18)",
                  }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <span className="text-[11px] font-semibold uppercase tracking-[.07em] text-indigo-400">
                      Step {row.index + 1} · Day {row.displayDay}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemove(row.step.key)}
                      className="text-[11.5px] text-muted-foreground transition-colors hover:text-destructive"
                    >
                      remove
                    </button>
                  </div>

                  {/* Body */}
                  <div className="flex flex-col gap-4 p-4">
                    {/* Template picker */}
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted-foreground">
                        Email template
                      </Label>
                      <StepTemplatePicker
                        value={row.step.templateId}
                        templates={templates}
                        hasNoTemplates={hasNoTemplates}
                        onChange={(id) => onTemplate(row.step.key, id)}
                      />
                    </div>

                    {/* Channel + Delay row */}
                    <div className="flex gap-3">
                      {/* Channel segmented control */}
                      <div className="flex flex-1 flex-col gap-1.5">
                        <Label className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted-foreground">
                          Channel
                        </Label>
                        <div className="flex gap-1.5">
                          {CHANNEL_OPTIONS.map((opt) => {
                            const active = row.step.channel === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => onChannel(row.step.key, opt.value)}
                                className={cn(
                                  "flex-1 rounded-[7px] border py-[7px] text-center text-[12px] transition-colors",
                                  active
                                    ? "border-indigo-500/45 bg-indigo-500/12 text-indigo-200"
                                    : "border-border text-muted-foreground hover:border-indigo-500/25 hover:text-foreground",
                                )}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Delay days input */}
                      <div className="flex w-[120px] flex-col gap-1.5">
                        <Label
                          htmlFor={`delay-${row.step.key}`}
                          className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted-foreground"
                        >
                          Send after
                        </Label>
                        <div className="flex items-center gap-1.5">
                          <Input
                            id={`delay-${row.step.key}`}
                            type="number"
                            min={0}
                            value={row.step.delayDays === 0 ? "" : row.step.delayDays}
                            placeholder="0"
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              onDelay(row.step.key, Number.isNaN(n) ? 0 : n);
                            }}
                            className="w-full"
                          />
                          <span className="shrink-0 text-[10.5px] text-muted-foreground">days</span>
                        </div>
                      </div>
                    </div>

                    {/* Options toggles */}
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted-foreground">
                        Options
                      </Label>
                      <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`payment-link-${row.step.key}`}
                            checked={row.step.includePaymentLink}
                            onCheckedChange={() => onTogglePaymentLink(row.step.key)}
                            size="sm"
                          />
                          <Label
                            htmlFor={`payment-link-${row.step.key}`}
                            className="cursor-pointer text-sm"
                          >
                            Payment link
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`owner-alert-${row.step.key}`}
                            checked={row.step.isOwnerAlert}
                            onCheckedChange={() => onToggleOwnerAlert(row.step.key)}
                            size="sm"
                          />
                          <Label
                            htmlFor={`owner-alert-${row.step.key}`}
                            className="cursor-pointer text-sm"
                          >
                            Owner alert
                          </Label>
                        </div>
                      </div>
                    </div>

                    {/* Done button */}
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        disabled={!row.isComplete}
                        onClick={onDone}
                        className="text-xs"
                        size="sm"
                      >
                        Done — add next ↓
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Wait label between steps */}
            {nextRow && (
              <p className="mb-3 ml-0.5 text-[10.5px] text-muted-foreground">
                ↓ wait {nextRow.step.delayDays} days
              </p>
            )}
          </div>
        );
      })}

      {/* Add another step ghost node */}
      <div className="relative mt-0.5">
        {/* Ghost dot */}
        <div className="absolute -left-[37px] top-1.5 flex h-[30px] w-[30px] items-center justify-center rounded-[9px] border border-dashed border-indigo-500/50 bg-background text-base text-indigo-400">
          +
        </div>
        <button
          type="button"
          disabled={atCap}
          onClick={onAdd}
          className="w-full cursor-pointer rounded-[10px] border border-dashed border-indigo-500/40 px-3.5 py-3 text-left text-[12.5px] text-indigo-400 transition-colors hover:border-indigo-500/60 hover:text-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add another step
        </button>
        {atCap && (
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Maximum of {MAX_STEPS} steps reached.
          </p>
        )}
      </div>
    </div>
  );
}
