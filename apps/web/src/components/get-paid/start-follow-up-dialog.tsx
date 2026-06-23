import { Check, Mail, Send, X } from "lucide-react";
import { cn } from "../../lib/utils";

interface StartFollowUpDialogProps {
  isOpen: boolean;
  invoiceNumber: string;
  customerName: string;
  // Formatted balance string (e.g. "$4,500") shown in the email preview.
  // A backend endpoint for the exact resolved template is a tracked follow-up.
  amount: string;
  isPending: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function StartFollowUpDialog({
  isOpen,
  invoiceNumber,
  customerName,
  amount,
  isPending,
  error,
  onConfirm,
  onCancel,
}: StartFollowUpDialogProps) {
  if (!isOpen) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sfu-dialog-title"
    >
      {/* Panel — stop propagation so clicking inside doesn't close */}
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#C5C6CF] px-6 py-5">
          <div>
            <h2
              id="sfu-dialog-title"
              className="text-[17px] font-semibold leading-snug text-[#1A1C1C]"
            >
              Start follow-up — {invoiceNumber} · {customerName}
            </h2>
            <p className="mt-0.5 text-sm text-[#45464E]">
              Your default follow-up sequence.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close dialog"
            className="ml-4 mt-0.5 shrink-0 rounded-md p-1 text-[#45464E] transition-colors hover:bg-[#F3F3F3] hover:text-[#1A1C1C]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-5">
          {/*
           * Email preview card.
           * This is a representative default preview, NOT the exact resolved sequence template.
           * Exact preview requires a backend endpoint — tracked as a follow-up.
           */}
          <div className="rounded-lg border border-[#C5C6CF] bg-[#F3F3F3] p-5">
            {/* Card label */}
            <div className="mb-3 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-[#45464E]" aria-hidden="true" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#45464E]">
                Email Preview
              </span>
            </div>

            {/* Email body */}
            <div className="space-y-3 text-sm leading-relaxed text-[#1A1C1C]">
              <p>Hi {customerName} team,</p>
              <p>
                This is a friendly reminder that invoice {invoiceNumber} for{" "}
                <span className="font-medium">{amount}</span> is currently past due. We&apos;d
                appreciate it if you could process this payment at your earliest convenience.
              </p>
              <p>If you&apos;ve already sent payment, please disregard this message.</p>
              <p className="text-[#45464E]">
                Best regards,
                <br />
                Nudge Billing
              </p>
            </div>
          </div>

          {/* Checkboxes — display only, both checked; backend ignores them */}
          <div className="space-y-3">
            {/* Checkbox 1: Include payment link */}
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded bg-[#041534]"
              >
                <Check className="h-3 w-3 text-white" strokeWidth={3} />
              </span>
              <div>
                <span className="text-sm font-medium text-[#1A1C1C]">Include payment link</span>
                <p className="text-xs text-[#45464E]">Adds a payment link to the email body.</p>
              </div>
            </div>

            {/* Checkbox 2: Send by email */}
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded bg-[#041534]"
              >
                <Check className="h-3 w-3 text-white" strokeWidth={3} />
              </span>
              <span className="text-sm font-medium text-[#1A1C1C]">Send by email</span>
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-[#FFB4AB] bg-[#FFDAD6] px-3 py-2 text-sm text-[#93000A]">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#C5C6CF] px-6 py-4">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              className="rounded-lg border border-[#C5C6CF] px-4 py-2 text-sm font-medium text-[#45464E] transition-colors hover:bg-[#F3F3F3] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isPending}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                "bg-[#0B61A1] hover:bg-[#0a5690]",
              )}
            >
              <Send className="h-4 w-4" />
              {isPending ? "Starting…" : "Send & start sequence"}
            </button>
          </div>
          <p className="mt-3 text-center text-[11px] text-[#45464E]">
            By starting this sequence, automated follow-ups will be sent according to your schedule.
          </p>
        </div>
      </div>
    </div>
  );
}
