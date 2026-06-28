import { useCallback, useState } from "react";
import { useActiveBusinessId } from "../lib/hooks/use-active-business-id";
import { useTriggerManualSync } from "../queries/use-businesses";

export interface SettingsViewModel {
  canResync: boolean;
  isResyncing: boolean;
  resyncMessage: string | null;
  resyncError: string | null;
  resyncAllInvoices: () => Promise<void>;
}

export function useSettingsViewModel(): SettingsViewModel {
  const { businessId } = useActiveBusinessId();
  const triggerSync = useTriggerManualSync();
  const [resyncMessage, setResyncMessage] = useState<string | null>(null);
  const [resyncError, setResyncError] = useState<string | null>(null);

  const resyncAllInvoices = useCallback(async () => {
    if (!businessId) return;
    setResyncMessage(null);
    setResyncError(null);
    try {
      await triggerSync.mutateAsync({ businessId, full: true });
      setResyncMessage(
        "Full resync queued. Your invoices will refresh in the background — this can take a few minutes.",
      );
    } catch (e) {
      setResyncError(
        e instanceof Error ? e.message : "Couldn't start the resync. Try again.",
      );
    }
  }, [businessId, triggerSync]);

  return {
    canResync: Boolean(businessId),
    isResyncing: triggerSync.isPending,
    resyncMessage,
    resyncError,
    resyncAllInvoices,
  };
}
