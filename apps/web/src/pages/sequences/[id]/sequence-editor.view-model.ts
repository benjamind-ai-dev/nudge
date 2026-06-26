import { useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { useActiveBusinessId } from "@/lib/hooks/use-active-business-id";
import { useCreateSequence, useEnrollInvoices, useAttachCustomer } from "@/queries/use-sequences";
import { useTemplates } from "@/queries/use-templates";
import type { TemplateListItem } from "@/api/templates.api";
import type { CreateSequenceStep } from "@/api/sequences.api";
import type { AudienceSelection } from "@/components/sequences/use-audience-picker";

export interface DraftStep {
  key: string; templateId: string | null; templateName: string;
  channel: "email" | "sms" | "email_and_sms"; delayDays: number;
  isOwnerAlert: boolean; includePaymentLink: boolean;
}

let SEQ = 0;
function newStep(): DraftStep {
  SEQ += 1;
  return { key: `s${SEQ}`, templateId: null, templateName: "", channel: "email", delayDays: 0, isOwnerAlert: false, includePaymentLink: true };
}

export interface StepRow {
  step: DraftStep;
  index: number;
  displayDay: number;
  isActive: boolean;
  isComplete: boolean;
}

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
  const { data: tmplData, isLoading: templatesLoading } = useTemplates(businessId);
  const createMut = useCreateSequence();
  const attachMut = useAttachCustomer();
  const enrollMut = useEnrollInvoices();

  const [name, setName] = useState("");
  // Seed once via a ref so both useState calls derive from the same newStep() call,
  // with no reliance on SEQ ordering or lazy-initializer sequencing.
  const seededRef = useRef<DraftStep[] | null>(null);
  if (!seededRef.current) seededRef.current = [newStep()];
  const [steps, setSteps] = useState<DraftStep[]>(seededRef.current);
  const [activeStepKey, setActiveStepKey] = useState<string | null>(seededRef.current[0].key);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ name?: string; steps?: string }>({});
  const [audience, setAudienceState] = useState<AudienceSelection | null>(null);
  const [createdSequenceId, setCreatedSequenceId] = useState<string | null>(null);

  const setAudience = useCallback((sel: AudienceSelection | null) => {
    setAudienceState(sel);
  }, []);

  const templates: TemplateListItem[] = tmplData?.data ?? [];
  const hasNoTemplates = !templatesLoading && templates.length === 0;

  function isStepComplete(s: DraftStep): boolean {
    return !!s.templateId;
  }

  function patch(key: string, p: Partial<DraftStep>) {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...p } : s)));
  }
  function addStep() {
    if (steps.length >= 10) return;
    const step = newStep();
    setSteps((p) => [...p, step]);
    setActiveStepKey(step.key);
  }
  function removeStep(key: string) {
    setSteps((p) => p.filter((s) => s.key !== key));
    setActiveStepKey((prev) => (prev === key ? null : prev));
  }
  function editStep(key: string) { setActiveStepKey(key); }
  function doneStep() {
    const active = steps.find((s) => s.key === activeStepKey);
    if (active && isStepComplete(active)) {
      setActiveStepKey(null);
    }
  }
  function moveStep(key: string, dir: "up" | "down") {
    setSteps((p) => {
      const i = p.findIndex((s) => s.key === key);
      const j = dir === "up" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= p.length) return p;
      const next = [...p]; [next[i], next[j]] = [next[j], next[i]]; return next;
    });
  }
  function setStepTemplate(key: string, templateId: string) {
    const t = templates.find((x) => x.id === templateId);
    patch(key, { templateId, templateName: t?.name ?? "" });
  }
  const setStepChannel = (key: string, channel: DraftStep["channel"]) => patch(key, { channel });
  const setStepDelay = (key: string, delayDays: number) => patch(key, { delayDays: Math.max(0, Math.floor(delayDays || 0)) });
  const toggleOwnerAlert = (key: string) => setSteps((p) => p.map((s) => s.key === key ? { ...s, isOwnerAlert: !s.isOwnerAlert } : s));
  const togglePaymentLink = (key: string) => setSteps((p) => p.map((s) => s.key === key ? { ...s, includePaymentLink: !s.includePaymentLink } : s));

  const rows: StepRow[] = useMemo(() => {
    let cumulative = 0;
    return steps.map((step, index) => {
      cumulative += step.delayDays;
      return {
        step,
        index,
        displayDay: cumulative,
        isActive: step.key === activeStepKey,
        isComplete: isStepComplete(step),
      };
    });
  }, [steps, activeStepKey]);

  const canSave = name.trim().length > 0 && steps.length > 0 && steps.every((s) => s.templateId);

  async function save() {
    setError(null);
    const e: { name?: string; steps?: string } = {};
    if (name.trim().length === 0) e.name = "Name is required.";
    if (steps.length === 0) e.steps = "Add at least one step.";
    else if (steps.some((s) => !s.templateId)) e.steps = "Every step needs a template.";
    setErrors(e);
    if (e.name || e.steps) return;

    const payload: CreateSequenceStep[] = steps.map((s, i) => {
      const t = templates.find((x) => x.id === s.templateId);
      return {
        templateId: s.templateId,
        stepOrder: i + 1,
        delayDays: s.delayDays,
        channel: s.channel,
        subjectTemplate: t?.subject ?? null,
        bodyTemplate: t?.body ?? "",          // API requires bodyTemplate; source from the template
        smsBodyTemplate: null,               // SMS content comes from the template (Part 5)
        isOwnerAlert: s.isOwnerAlert,
        includePaymentLink: s.includePaymentLink,
      };
    });
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
