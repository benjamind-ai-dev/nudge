import { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { useActiveBusinessId } from "@/lib/hooks/use-active-business-id";
import { useCreateSequence, useEnrollInvoices, useAttachCustomer } from "@/queries/use-sequences";
import { useStepDraft } from "./use-step-draft";
import type { AudienceSelection } from "@/components/sequences/use-audience-picker";

function audienceHasSelection(sel: AudienceSelection): boolean {
  if (sel.mode === "customer") return sel.customerIds.length > 0;
  return sel.invoiceIds.length > 0;
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

export function useSequenceEditorViewModel() {
  const navigate = useNavigate();
  const { businessId } = useActiveBusinessId();
  const createMut = useCreateSequence();
  const attachMut = useAttachCustomer();
  const enrollMut = useEnrollInvoices();

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ name?: string; steps?: string }>({});
  const [audience, setAudienceState] = useState<AudienceSelection | null>(null);
  const [createdSequenceId, setCreatedSequenceId] = useState<string | null>(null);

  const setAudience = useCallback((sel: AudienceSelection | null) => {
    setAudienceState(sel);
  }, []);

  const stepDraft = useStepDraft(businessId);
  const {
    steps,
    rows,
    activeStepKey,
    addStep,
    removeStep,
    moveStep,
    editStep,
    doneStep,
    isStepComplete,
    setStepTemplate,
    setStepChannel,
    setStepDelay,
    toggleOwnerAlert,
    togglePaymentLink,
    templates,
    templatesLoading,
    hasNoTemplates,
    allStepsComplete,
    buildPayload,
  } = stepDraft;

  const canSave = name.trim().length > 0 && allStepsComplete;

  async function save() {
    setError(null);
    const e: { name?: string; steps?: string } = {};
    if (name.trim().length === 0) e.name = "Name is required.";
    if (steps.length === 0) e.steps = "Add at least one step.";
    else if (steps.some((s) => !s.templateId)) e.steps = "Every step needs a template.";
    setErrors(e);
    if (e.name || e.steps) return;

    const payload = buildPayload();

    // localSeqId tracks whether a sequence id is known in this execution (either
    // previously stored in state or freshly created). The catch block uses it
    // synchronously since React state from setCreatedSequenceId won't be visible
    // until the next render.
    let localSeqId: string | null = createdSequenceId;
    try {
      if (!localSeqId) {
        const res = await createMut.mutateAsync({ businessId, name: name.trim(), steps: payload });
        localSeqId = res.data.id;
        setCreatedSequenceId(localSeqId);
      }
      if (audience && audienceHasSelection(audience)) {
        if (audience.mode === "customer") {
          for (const customerId of audience.customerIds) {
            await attachMut.mutateAsync({ sequenceId: localSeqId, businessId, customerId });
          }
        } else {
          if (audience.invoiceIds.length > 0) {
            await enrollMut.mutateAsync({ sequenceId: localSeqId, businessId, invoiceIds: audience.invoiceIds });
          }
        }
      }
      navigate("/sequences");
    } catch (err) {
      // If localSeqId is set, the sequence already exists — attach step threw.
      // Report accordingly so the user can retry the attach without re-creating.
      setError(
        localSeqId
          ? `Sequence created, but attaching the audience failed: ${msg(err)}. Retry, or skip to the list.`
          : msg(err),
      );
    }
  }

  function skipAudience() { navigate("/sequences"); }

  function cancel() { navigate("/sequences"); }

  return {
    name, setName, steps, rows, activeStepKey,
    addStep, removeStep, moveStep, editStep, doneStep, isStepComplete,
    setStepTemplate, setStepChannel, setStepDelay, toggleOwnerAlert, togglePaymentLink,
    templates, templatesLoading, hasNoTemplates,
    canSave,
    isSaving: createMut.isPending || attachMut.isPending || enrollMut.isPending,
    error, errors, save, cancel,
    audience, setAudience, createdSequenceId, skipAudience,
    businessId,
  };
}
