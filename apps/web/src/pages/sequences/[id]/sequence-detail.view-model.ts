import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useActiveBusinessId } from "@/lib/hooks/use-active-business-id";
import {
  useSequence,
  usePauseSequence,
  useActivateSequence,
  useDetachCustomer,
  useReplaceSequence,
} from "@/queries/use-sequences";
import { useSequenceRuns, useStopSequenceRun } from "@/queries/use-sequence-runs";
import { formatCents } from "@/lib/format";
import { useStepDraft, draftStepFromDetail } from "./use-step-draft";

// ── Row shapes ────────────────────────────────────────────────────────────────

/**
 * One row in the "Flow" tab timeline.
 *
 * NOTE: `SequenceStepDetail` does NOT carry a `templateName` field — it only
 * has `templateId`. When `templateId` is present we show it as a short label
 * ("Template · <id>"); when absent we show "—". The API would need to expand
 * the template to surface a human name (tracked as a deferred improvement).
 */
export interface StepRow {
  key: string;
  /** Cumulative day number (sum of all delayDays up to and including this step). */
  displayDay: number;
  /** Raw template id for name resolution; null if not set. */
  templateId: string | null;
  /** Human-readable template label derived from templateId, or "—". */
  templateName: string;
  channel: "email" | "sms" | "email_and_sms";
  delayDays: number;
}

export interface RunRow {
  runId: string;
  customerId: string;
  customerName: string;
  invoiceNumber: string;
  amountText: string;
  invoiceStatus: string;
  runStatus: string;
}

// ── View model ────────────────────────────────────────────────────────────────

export function useSequenceDetailViewModel(id: string) {
  const { businessId } = useActiveBusinessId();

  const sequenceQuery = useSequence(id, businessId);
  const runsQuery = useSequenceRuns({ businessId, sequenceId: id });

  const sequence = sequenceQuery.data?.data;
  const runs = runsQuery.data?.data ?? [];

  // ── tab state ─────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<"flow" | "audience">("flow");

  // ── error state ───────────────────────────────────────────────────────────
  const [error, setError] = useState<string | null>(null);

  // ── derived from sequence ─────────────────────────────────────────────────
  const name = sequence?.name ?? "";
  const isActive = sequence?.isActive ?? false;
  const canEditSteps = (sequence?.activeRuns ?? 0) === 0;

  // ── editable step draft (only meaningful when canEditSteps) ───────────────
  const stepDraft = useStepDraft(businessId);
  const replaceMut = useReplaceSequence();

  // Seed the draft once when sequence loads (for edit mode)
  const seededRef = useRef(false);
  useEffect(() => {
    if (sequence && stepDraft.templates.length > 0 && !seededRef.current) {
      const sorted = [...sequence.steps].sort((a, b) => a.stepOrder - b.stepOrder);
      const seeded = sorted.map((s) => draftStepFromDetail(s, stepDraft.templates));
      if (seeded.length > 0) {
        stepDraft.seed(seeded);
        seededRef.current = true;
      }
    }
  }, [sequence, stepDraft.templates]);

  const saveSteps = useCallback(async () => {
    if (!sequence) return;
    setError(null);
    try {
      await replaceMut.mutateAsync({
        id: sequence.id,
        businessId,
        name: sequence.name,
        steps: stepDraft.buildPayload(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save steps.");
    }
  }, [replaceMut, sequence, businessId, stepDraft]);

  const savingSteps = replaceMut.isPending;

  // ── step rows (cumulative day) ────────────────────────────────────────────
  const stepRows = useMemo<StepRow[]>(() => {
    const steps = sequence?.steps ?? [];
    // Sort by stepOrder to ensure correct cumulative calculation
    const sorted = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
    let cumulative = 0;
    return sorted.map((step) => {
      cumulative += step.delayDays;
      return {
        key: step.id,
        displayDay: cumulative,
        templateId: step.templateId ?? null,
        // SequenceStepDetail only carries templateId — no templateName on the type.
        // We derive a short label from it so the UI isn't blank; the page can
        // resolve the real name via useTemplates + templateId.
        templateName: step.templateId ? `Template · ${step.templateId}` : "—",
        channel: step.channel,
        delayDays: step.delayDays,
      };
    });
  }, [sequence]);

  // ── run rows ──────────────────────────────────────────────────────────────
  const runRows = useMemo<RunRow[]>(() => {
    return runs.map((run) => ({
      runId: run.id,
      customerId: run.customer.id,
      customerName: run.customer.companyName,
      invoiceNumber: run.invoice.invoiceNumber ?? "—",
      amountText: formatCents(run.invoice.amountCents),
      invoiceStatus: run.invoice.status,
      runStatus: run.status,
    }));
  }, [runs]);

  // ── mutations ─────────────────────────────────────────────────────────────
  const pauseMut = usePauseSequence();
  const activateMut = useActivateSequence();
  const stopRunMut = useStopSequenceRun();
  const detachMut = useDetachCustomer();

  const pause = useCallback(async () => {
    setError(null);
    try {
      await pauseMut.mutateAsync({ id, businessId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pause sequence.");
    }
  }, [pauseMut, id, businessId]);

  const activate = useCallback(async () => {
    setError(null);
    try {
      await activateMut.mutateAsync({ id, businessId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate sequence.");
    }
  }, [activateMut, id, businessId]);

  const removeInvoice = useCallback(
    async (runId: string) => {
      setError(null);
      try {
        await stopRunMut.mutateAsync({ id: runId, businessId });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to stop run.");
      }
    },
    [stopRunMut, businessId],
  );

  const removeCustomer = useCallback(
    async (customerId: string) => {
      setError(null);
      try {
        await detachMut.mutateAsync({ id, businessId, customerId });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to detach customer.");
      }
    },
    [detachMut, id, businessId],
  );

  return {
    // sequence metadata
    name,
    isActive,
    canEditSteps,
    businessId,
    // rows (read-only view)
    stepRows,
    runRows,
    // tab
    tab,
    setTab,
    // actions
    pause,
    activate,
    removeInvoice,
    removeCustomer,
    // mutation pending states
    isPausing: pauseMut.isPending,
    isActivating: activateMut.isPending,
    // loading / error
    isLoading: sequenceQuery.isLoading,
    error,
    // ── editable step draft (only meaningful when canEditSteps) ─────────────
    draftRows: stepDraft.rows,
    templates: stepDraft.templates,
    templatesLoading: stepDraft.templatesLoading,
    hasNoTemplates: stepDraft.hasNoTemplates,
    allStepsComplete: stepDraft.allStepsComplete,
    addStep: stepDraft.addStep,
    removeStep: stepDraft.removeStep,
    editStep: stepDraft.editStep,
    doneStep: stepDraft.doneStep,
    setStepTemplate: stepDraft.setStepTemplate,
    setStepChannel: stepDraft.setStepChannel,
    setStepDelay: stepDraft.setStepDelay,
    toggleOwnerAlert: stepDraft.toggleOwnerAlert,
    togglePaymentLink: stepDraft.togglePaymentLink,
    saveSteps,
    savingSteps,
  };
}
