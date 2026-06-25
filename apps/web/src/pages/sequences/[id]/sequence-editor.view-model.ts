import { useState } from "react";
import { useNavigate } from "react-router";
import { useActiveBusinessId } from "@/lib/hooks/use-active-business-id";
import { useCreateSequence } from "@/queries/use-sequences";
import { useTemplates } from "@/queries/use-templates";
import type { TemplateListItem } from "@/api/templates.api";
import type { CreateSequenceStep } from "@/api/sequences.api";

export interface DraftStep {
  key: string; templateId: string | null; templateName: string;
  channel: "email" | "sms" | "email_and_sms"; delayDays: number;
  isOwnerAlert: boolean; includePaymentLink: boolean; smsBodyTemplate: string;
}

let SEQ = 0;
function newStep(): DraftStep {
  SEQ += 1;
  return { key: `s${SEQ}`, templateId: null, templateName: "", channel: "email", delayDays: 0, isOwnerAlert: false, includePaymentLink: true, smsBodyTemplate: "" };
}

export function useSequenceEditorViewModel() {
  const navigate = useNavigate();
  const { businessId } = useActiveBusinessId();
  const { data: tmplData, isLoading: templatesLoading } = useTemplates(businessId);
  const createMut = useCreateSequence();

  const [name, setName] = useState("");
  // Start with one empty step so the editor isn't blank — the user fills it in
  // rather than having to click "Add step" for the first one.
  const [steps, setSteps] = useState<DraftStep[]>(() => [newStep()]);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ name?: string; steps?: string }>({});

  const templates: TemplateListItem[] = tmplData?.data ?? [];
  const hasNoTemplates = !templatesLoading && templates.length === 0;

  function patch(key: string, p: Partial<DraftStep>) {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...p } : s)));
  }
  function addStep() { setSteps((p) => (p.length >= 10 ? p : [...p, newStep()])); }
  function removeStep(key: string) { setSteps((p) => p.filter((s) => s.key !== key)); }
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
  const setStepSms = (key: string, body: string) => patch(key, { smsBodyTemplate: body });

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
        smsBodyTemplate: s.channel === "email" ? null : (s.smsBodyTemplate || null),
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
    name, setName, steps,
    addStep, removeStep, moveStep,
    setStepTemplate, setStepChannel, setStepDelay, toggleOwnerAlert, togglePaymentLink, setStepSms,
    templates, templatesLoading, hasNoTemplates,
    canSave, isSaving: createMut.isPending, error, errors, save, cancel,
  };
}
