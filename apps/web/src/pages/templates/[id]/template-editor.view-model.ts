import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  useCreateTemplate,
  useGenerateTemplate,
  useTemplate,
  useUpdateTemplate,
} from "@/queries/use-templates";
import { useActiveBusinessId } from "@/lib/hooks/use-active-business-id";

export const SAMPLE_DATA: Record<string, string> = {
  company_name: "Acme Books",
  contact_name: "Jordan",
  invoice_number: "#INV-1042",
  amount: "$2,400",
  balance_due: "$2,400",
  due_date: "Jun 10, 2026",
  days_overdue: "14",
  payment_link: "https://pay.nudge.app/inv-1042",
  sender_name: "Sarah Chen",
};

export function resolveVariables(
  text: string,
  data: Record<string, string> = SAMPLE_DATA,
): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    key in data ? data[key] : match,
  );
}

const PAYMENT_LINK_TOKEN = /\{\{\s*payment_link\s*\}\}/g;

export interface TemplatePreviewModel {
  senderName: string;
  recipientEmail: string;
  subject: string;
  bodyHtml: string;
  signatureHtml: string | null;
  hasPaymentLink: boolean;
}

export function useTemplateEditorViewModel(templateId: string | undefined) {
  const navigate = useNavigate();
  const { businessId, senderName } = useActiveBusinessId();
  const isNew = !templateId;

  const { data, isLoading } = useTemplate(templateId, businessId);
  const createMut = useCreateTemplate();
  const updateMut = useUpdateTemplate();
  const generateMut = useGenerateTemplate();

  const [nameValue, setNameValue] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyValue, setBodyValue] = useState("");
  const [signature, setSignature] = useState("");
  const [aiDescription, setAiDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ name?: string; subject?: string; body?: string }>({});
  const snapshotRef = useRef<{ name: string; subject: string; body: string; signature: string } | null>(null);

  // Hydrate from the loaded template once it arrives.
  useEffect(() => {
    if (data?.data) {
      const name = data.data.name;
      const subject = data.data.subject ?? "";
      const body = data.data.body;
      const signature = data.data.signature ?? "";
      setNameValue(name);
      setSubject(subject);
      setBodyValue(body);
      setSignature(signature);
      // Snapshot the original values for dirty tracking (only set once).
      if (!snapshotRef.current) {
        snapshotRef.current = { name, subject, body, signature };
      }
    }
  }, [data]);

  function setName(v: string) {
    setNameValue(v);
    if (v.trim()) setErrors((e) => ({ ...e, name: undefined }));
  }

  function setBody(v: string) {
    setBodyValue(v);
    if (v.trim()) setErrors((e) => ({ ...e, body: undefined }));
  }

  function setSubjectWrapped(v: string) {
    setSubject(v);
    if (v.trim()) setErrors((e) => ({ ...e, subject: undefined }));
  }

  const canSave =
    nameValue.trim().length > 0 &&
    subject.trim().length > 0 &&
    bodyValue.trim().length > 0;

  const isDirty = useMemo(() => {
    if (isNew) return true;
    if (!snapshotRef.current) return false;
    const snap = snapshotRef.current;
    return (
      nameValue !== snap.name ||
      subject !== snap.subject ||
      bodyValue !== snap.body ||
      signature !== snap.signature
    );
  }, [isNew, nameValue, subject, bodyValue, signature]);

  async function handleSave() {
    const nextErrors: { name?: string; subject?: string; body?: string } = {};
    if (!nameValue.trim()) nextErrors.name = "Template name is required.";
    if (!subject.trim()) nextErrors.subject = "Subject is required.";
    if (!bodyValue.trim()) nextErrors.body = "Email body is required.";
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.subject || nextErrors.body) return;

    setError(null);
    try {
      if (isNew) {
        await createMut.mutateAsync({
          businessId,
          name: nameValue.trim(),
          subject: subject.trim(),
          body: bodyValue,
          signature: signature.trim() ? signature.trim() : null,
        });
      } else {
        await updateMut.mutateAsync({
          id: templateId as string,
          input: {
            businessId,
            name: nameValue.trim(),
            subject: subject.trim(),
            body: bodyValue,
            signature: signature.trim() ? signature.trim() : null,
          },
        });
      }
      navigate("/templates");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the template.");
    }
  }

  async function handleGenerate() {
    if (!aiDescription.trim()) return;
    setError(null);
    try {
      const res = await generateMut.mutateAsync({ businessId, description: aiDescription });
      setNameValue(res.data.name);
      setSubject(res.data.subject);
      setBodyValue(res.data.body);
      setSignature(res.data.signature);
      setErrors({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't draft the template.");
    }
  }

  function handleDiscard() {
    navigate("/templates");
  }

  const preview: TemplatePreviewModel = useMemo(() => {
    const hasPaymentLink = PAYMENT_LINK_TOKEN.test(bodyValue);
    PAYMENT_LINK_TOKEN.lastIndex = 0; // reset stateful global regex
    const bodyNoLink = bodyValue.replace(PAYMENT_LINK_TOKEN, "");
    return {
      senderName: senderName || SAMPLE_DATA.sender_name,
      recipientEmail: "jordan@brightmail.co",
      subject: resolveVariables(subject),
      bodyHtml: resolveVariables(bodyNoLink),
      signatureHtml: signature.trim() ? resolveVariables(signature) : null,
      hasPaymentLink,
    };
  }, [subject, bodyValue, signature, senderName]);

  return {
    name: nameValue, subject, body: bodyValue, signature,
    setName, setSubject: setSubjectWrapped, setBody, setSignature,
    isNew,
    isLoading: !isNew && isLoading,
    isSaving: createMut.isPending || updateMut.isPending,
    isGenerating: generateMut.isPending,
    canSave,
    isDirty,
    errors,
    error,
    aiDescription, setAiDescription,
    handleGenerate, handleSave, handleDiscard,
    preview,
  };
}
