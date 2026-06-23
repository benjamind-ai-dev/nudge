import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Start follow-up — {invoiceNumber} · {customerName}
          </DialogTitle>
          <DialogDescription>Your default follow-up sequence.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/*
           * Email preview card.
           * This is a representative default preview, NOT the exact resolved sequence template.
           * Exact preview requires a backend endpoint — tracked as a follow-up.
           */}
          <div className="rounded-lg border bg-muted p-5">
            {/* Card label */}
            <div className="mb-3 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Email Preview
              </span>
            </div>

            {/* Email body */}
            <div className="space-y-3 text-sm leading-relaxed text-foreground">
              <p>Hi {customerName} team,</p>
              <p>
                This is a friendly reminder that invoice {invoiceNumber} for{" "}
                <span className="font-medium">{amount}</span> is currently past due.
                We&apos;d appreciate it if you could process this payment at your earliest
                convenience.
              </p>
              <p>If you&apos;ve already sent payment, please disregard this message.</p>
              <p className="text-muted-foreground">
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
              <Checkbox
                id="sfu-payment-link"
                checked
                disabled
                className="mt-0.5"
                aria-label="Include payment link"
              />
              <div>
                <label
                  htmlFor="sfu-payment-link"
                  className="text-sm font-medium text-foreground"
                >
                  Include payment link
                </label>
                <p className="text-xs text-muted-foreground">
                  Adds a payment link to the email body.
                </p>
              </div>
            </div>

            {/* Checkbox 2: Send by email */}
            <div className="flex items-center gap-3">
              <Checkbox
                id="sfu-send-email"
                checked
                disabled
                aria-label="Send by email"
              />
              <label htmlFor="sfu-send-email" className="text-sm font-medium text-foreground">
                Send by email
              </label>
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? "Starting…" : "Send & start sequence"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
