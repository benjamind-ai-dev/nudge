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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface StartFollowUpDialogProps {
  isOpen: boolean;
  invoiceNumber: string;
  customerName: string;
  isPending: boolean;
  error: string | null;
  // Editable fields
  subject: string;
  body: string;
  includePaymentLink: boolean;
  sendByEmail: boolean;
  onSubjectChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onToggleIncludePaymentLink: () => void;
  onToggleSendByEmail: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function StartFollowUpDialog({
  isOpen,
  invoiceNumber,
  customerName,
  isPending,
  error,
  subject,
  body,
  includePaymentLink,
  sendByEmail,
  onSubjectChange,
  onBodyChange,
  onToggleIncludePaymentLink,
  onToggleSendByEmail,
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Start follow-up — {invoiceNumber} · {customerName}
          </DialogTitle>
          <DialogDescription>Your default follow-up sequence.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Subject field */}
          <div className="space-y-1.5">
            <Label htmlFor="sfu-subject" className="text-sm font-medium text-foreground">
              Subject
            </Label>
            <Input
              id="sfu-subject"
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              disabled={isPending}
              className="bg-card text-foreground"
            />
          </div>

          {/* Body field */}
          <div className="space-y-1.5">
            <Label htmlFor="sfu-body" className="text-sm font-medium text-foreground">
              Message
            </Label>
            <Textarea
              id="sfu-body"
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              disabled={isPending}
              rows={8}
              className="resize-none bg-card text-foreground"
            />
          </div>

          {/* Checkboxes */}
          <div className="space-y-3">
            {/* Include payment link */}
            <div className="flex items-start gap-3">
              <Checkbox
                id="sfu-payment-link"
                checked={includePaymentLink}
                onCheckedChange={onToggleIncludePaymentLink}
                disabled={isPending}
                className="mt-0.5"
                aria-label="Include payment link"
              />
              <div>
                <label
                  htmlFor="sfu-payment-link"
                  className="cursor-pointer text-sm font-medium text-foreground"
                >
                  Include payment link
                </label>
                <p className="text-xs text-muted-foreground">Adds a payment link to the email</p>
              </div>
            </div>

            {/* Send by email */}
            <div className="flex items-start gap-3">
              <Checkbox
                id="sfu-send-email"
                checked={sendByEmail}
                onCheckedChange={onToggleSendByEmail}
                disabled={isPending}
                className="mt-0.5"
                aria-label="Send by email"
              />
              <div>
                <label
                  htmlFor="sfu-send-email"
                  className="cursor-pointer text-sm font-medium text-foreground"
                >
                  Send by email
                </label>
                <p className="text-xs text-muted-foreground">
                  Send the first reminder now
                </p>
              </div>
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
