import { useState, useMemo, useRef } from "react";
import { useTemplates } from "@/queries/use-templates";
import type { TemplateListItem } from "@/api/templates.api";
import type { CreateSequenceStep, SequenceStepDetail } from "@/api/sequences.api";

export interface DraftStep {
  key: string;
  templateId: string | null;
  templateName: string;
  channel: "email" | "sms" | "email_and_sms";
  delayDays: number;
  isOwnerAlert: boolean;
  includePaymentLink: boolean;
}

let SEQ = 0;
export function newStep(): DraftStep {
  SEQ += 1;
  return {
    key: `s${SEQ}`,
    templateId: null,
    templateName: "",
    channel: "email",
    delayDays: 0,
    isOwnerAlert: false,
    includePaymentLink: true,
  };
}

export interface StepRow {
  step: DraftStep;
  index: number;
  displayDay: number;
  isActive: boolean;
  isComplete: boolean;
}

/** Map a loaded SequenceStepDetail to a DraftStep for seeding the edit flow. */
export function draftStepFromDetail(
  step: SequenceStepDetail,
  templates: TemplateListItem[],
): DraftStep {
  SEQ += 1;
  const found = templates.find((t) => t.id === step.templateId);
  return {
    key: `s${SEQ}`,
    templateId: step.templateId ?? null,
    templateName: found?.name ?? "",
    channel: step.channel,
    delayDays: step.delayDays,
    isOwnerAlert: step.isOwnerAlert ?? false,
    includePaymentLink: step.includePaymentLink ?? false,
  };
}

export interface UseStepDraftResult {
  steps: DraftStep[];
  rows: StepRow[];
  activeStepKey: string | null;
  addStep: () => void;
  removeStep: (key: string) => void;
  moveStep: (key: string, dir: "up" | "down") => void;
  editStep: (key: string) => void;
  doneStep: () => void;
  isStepComplete: (s: DraftStep) => boolean;
  setStepTemplate: (key: string, templateId: string) => void;
  setStepChannel: (key: string, channel: DraftStep["channel"]) => void;
  setStepDelay: (key: string, delayDays: number) => void;
  toggleOwnerAlert: (key: string) => void;
  togglePaymentLink: (key: string) => void;
  templates: TemplateListItem[];
  templatesLoading: boolean;
  hasNoTemplates: boolean;
  allStepsComplete: boolean;
  buildPayload: () => CreateSequenceStep[];
}

export function useStepDraft(
  businessId: string,
  opts?: { initialSteps?: DraftStep[] },
): UseStepDraftResult {
  const { data: tmplData, isLoading: templatesLoading } = useTemplates(businessId);
  const templates: TemplateListItem[] = tmplData?.data ?? [];
  const hasNoTemplates = !templatesLoading && templates.length === 0;

  // Seed once via a ref so both useState calls derive from the same seed,
  // with no reliance on SEQ ordering or lazy-initializer sequencing.
  const seededRef = useRef<DraftStep[] | null>(null);
  if (!seededRef.current) {
    seededRef.current = opts?.initialSteps ?? [newStep()];
  }
  const [steps, setSteps] = useState<DraftStep[]>(seededRef.current);
  const [activeStepKey, setActiveStepKey] = useState<string | null>(
    seededRef.current[0]?.key ?? null,
  );

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

  function editStep(key: string) {
    setActiveStepKey(key);
  }

  function doneStep() {
    setSteps((currentSteps) => {
      const active = currentSteps.find((s) => s.key === activeStepKey);
      if (active && isStepComplete(active)) {
        setActiveStepKey(null);
      }
      return currentSteps;
    });
  }

  function moveStep(key: string, dir: "up" | "down") {
    setSteps((p) => {
      const i = p.findIndex((s) => s.key === key);
      const j = dir === "up" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= p.length) return p;
      const next = [...p];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function setStepTemplate(key: string, templateId: string) {
    const t = templates.find((x) => x.id === templateId);
    patch(key, { templateId, templateName: t?.name ?? "" });
  }

  const setStepChannel = (key: string, channel: DraftStep["channel"]) =>
    patch(key, { channel });

  const setStepDelay = (key: string, delayDays: number) =>
    patch(key, { delayDays: Math.max(0, Math.floor(delayDays || 0)) });

  const toggleOwnerAlert = (key: string) =>
    setSteps((p) =>
      p.map((s) => (s.key === key ? { ...s, isOwnerAlert: !s.isOwnerAlert } : s)),
    );

  const togglePaymentLink = (key: string) =>
    setSteps((p) =>
      p.map((s) =>
        s.key === key ? { ...s, includePaymentLink: !s.includePaymentLink } : s,
      ),
    );

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

  const allStepsComplete = steps.length > 0 && steps.every((s) => !!s.templateId);

  function buildPayload(): CreateSequenceStep[] {
    return steps.map((s, i) => {
      const t = templates.find((x) => x.id === s.templateId);
      return {
        templateId: s.templateId,
        stepOrder: i + 1,
        delayDays: s.delayDays,
        channel: s.channel,
        subjectTemplate: t?.subject ?? null,
        bodyTemplate: t?.body ?? "",
        smsBodyTemplate: null,
        isOwnerAlert: s.isOwnerAlert,
        includePaymentLink: s.includePaymentLink,
      };
    });
  }

  return {
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
  };
}
