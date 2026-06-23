import { CheckSquare, Send, X } from "lucide-react";
import { cn } from "../../lib/utils";

interface StartFollowUpDialogProps {
  isOpen: boolean;
  invoiceNumber: string;
  customerName: string;
  isPending: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function StartFollowUpDialog({
  isOpen,
  invoiceNumber,
  customerName,
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
        className="relative w-full max-w-md rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#E5E7EB] px-6 py-5">
          <div>
            <h2
              id="sfu-dialog-title"
              className="text-[17px] font-semibold leading-snug text-[#1B2A4A]"
            >
              Start follow-up — {invoiceNumber} · {customerName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close dialog"
            className="ml-4 mt-0.5 shrink-0 rounded-md p-1 text-[#6B7280] transition-colors hover:bg-[#F5F5F5] hover:text-[#1B2A4A]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-5">
          <p className="text-sm text-[#6B7280]">
            Sequence: your default follow-up · first reminder sends today.
          </p>

          {/* Static checked checkboxes — display only */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <CheckSquare className="h-5 w-5 shrink-0 text-[#10B981]" aria-hidden="true" />
              <span className="text-sm text-[#1B2A4A]">Include payment link</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckSquare className="h-5 w-5 shrink-0 text-[#10B981]" aria-hidden="true" />
              <span className="text-sm text-[#1B2A4A]">Send by email</span>
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-[#FFB4AB] bg-[#FFDAD6] px-3 py-2 text-sm text-[#93000A]">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#6B7280] transition-colors hover:bg-[#F5F5F5] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              "bg-[#10B981] hover:bg-[#059669]",
            )}
          >
            <Send className="h-4 w-4" />
            {isPending ? "Starting…" : "Send & start sequence"}
          </button>
        </div>
      </div>
    </div>
  );
}
