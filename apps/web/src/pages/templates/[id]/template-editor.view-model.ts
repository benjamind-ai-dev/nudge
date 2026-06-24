import { useEffect, useMemo, useState } from "react";
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

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [signature, setSignature] = useState("");
  const [aiDescription, setAiDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Hydrate from the loaded template once it arrives.
  useEffect(() => {
    if (data?.data) {
      setName(data.data.name);
      setSubject(data.data.subject ?? "");
      setBody(data.data.body);
      setSignature(data.data.signature ?? "");
    }
  }, [data]);

  const canSave = name.trim().length > 0 && body.trim().length > 0;

  async function handleSave() {
    if (!canSave) return;
    setError(null);
    try {
      if (isNew) {
        await createMut.mutateAsync({
          businessId,
          name: name.trim(),
          subject: subject.trim() ? subject.trim() : null,
          body,
          signature: signature.trim() ? signature.trim() : null,
        });
      } else {
        await updateMut.mutateAsync({
          id: templateId as string,
          input: {
            businessId,
            name: name.trim(),
            subject: subject.trim() ? subject.trim() : null,
            body,
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
      setName(res.data.name);
      setSubject(res.data.subject);
      setBody(res.data.body);
      setSignature(res.data.signature);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't draft the template.");
    }
  }

  function handleDiscard() {
    navigate("/templates");
  }

  const preview: TemplatePreviewModel = useMemo(() => {
    const hasPaymentLink = PAYMENT_LINK_TOKEN.test(body);
    PAYMENT_LINK_TOKEN.lastIndex = 0; // reset stateful global regex
    const bodyNoLink = body.replace(PAYMENT_LINK_TOKEN, "");
    return {
      senderName: senderName || SAMPLE_DATA.sender_name,
      recipientEmail: "jordan@brightmail.co",
      subject: resolveVariables(subject),
      bodyHtml: resolveVariables(bodyNoLink),
      signatureHtml: signature.trim() ? resolveVariables(signature) : null,
      hasPaymentLink,
    };
  }, [subject, body, signature, senderName]);

  return {
    name, subject, body, signature,
    setName, setSubject, setBody, setSignature,
    isNew,
    isLoading: !isNew && isLoading,
    isSaving: createMut.isPending || updateMut.isPending,
    isGenerating: generateMut.isPending,
    canSave,
    error,
    aiDescription, setAiDescription,
    handleGenerate, handleSave, handleDiscard,
    preview,
  };
}
