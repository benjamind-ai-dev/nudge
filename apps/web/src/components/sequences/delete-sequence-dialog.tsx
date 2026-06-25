import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeleteSequenceDialogProps {
  target: { id: string; name: string } | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  error?: string | null;
}

export function DeleteSequenceDialog({
  target,
  isDeleting,
  onCancel,
  onConfirm,
  error,
}: DeleteSequenceDialogProps) {
  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this sequence?</DialogTitle>
          <DialogDescription>
            "{target?.name}" will be permanently removed. This can't be undone.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p className="text-sm font-medium text-destructive">{error}</p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
