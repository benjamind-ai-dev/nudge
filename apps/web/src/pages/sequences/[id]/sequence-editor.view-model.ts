import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { useActiveBusinessId } from "@/lib/hooks/use-active-business-id";
import { useCreateSequence } from "@/queries/use-sequences";
import { useTemplates } from "@/queries/use-templates";
import type { TemplateListItem } from "@/api/templates.api";
import type { CreateSequenceStep } from "@/api/sequences.api";

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

export function useSequenceEditorViewModel() {
  const navigate = useNavigate();
  const { businessId } = useActiveBusinessId();
  const { data: tmplData, isLoading: templatesLoading } = useTemplates(businessId);
  const createMut = useCreateSequence();

  const [name, setName] = useState("");
  // Start with one empty step so the editor isn't blank — the user fills it in
  // rather than having to click "Add step" for the first one.
  const [steps, setSteps] = useState<DraftStep[]>(() => {
    const seeded = newStep();
    return [seeded];
  });
  const [activeStepKey, setActiveStepKey] = useState<string | null>(() => {
    // Initialize to the seeded step's key — but since useState initializer runs
    // independently, we capture by synchronizing with steps init below.
    // We use a module-level trick: SEQ was incremented in newStep(), so the key is `s${SEQ}`.
    return `s${SEQ}`;
  });
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ name?: string; steps?: string }>({});

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
    setSteps((p) => (p.length >= 10 ? p : [...p, step]));
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
      const displayDay = index === 0 ? 0 : cumulative;
      return {
        step,
        index,
        displayDay,
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
    try {
      await createMut.mutateAsync({ businessId, name: name.trim(), steps: payload });
      navigate("/sequences");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the sequence.");
    }
  }

  function cancel() { navigate("/sequences"); }

  return {
    name, setName, steps, rows, activeStepKey,
    addStep, removeStep, moveStep, editStep, doneStep, isStepComplete,
    setStepTemplate, setStepChannel, setStepDelay, toggleOwnerAlert, togglePaymentLink,
    templates, templatesLoading, hasNoTemplates,
    canSave, isSaving: createMut.isPending, error, errors, save, cancel,
  };
}
