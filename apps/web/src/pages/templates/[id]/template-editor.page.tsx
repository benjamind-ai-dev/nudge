import { useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { useTemplateEditorViewModel } from "./template-editor.view-model";
import { TemplateEditorForm } from "@/components/templates/template-editor-form";
import { EmailPreview } from "@/components/templates/email-preview";
import { AiDraftBubble } from "@/components/templates/ai-draft-bubble";

export function TemplateEditorPage() {
  const { id } = useParams();
  const vm = useTemplateEditorViewModel(id);

  if (vm.isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-6 py-6 lg:px-10">
        <div className="h-64 animate-pulse rounded-[10px] bg-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5 px-6 py-6 lg:px-10">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground">
            Templates /{" "}
            <span className="font-semibold text-foreground">
              {vm.name || "New template"}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {vm.isNew ? "New template" : vm.name}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={vm.handleDiscard} disabled={vm.isSaving}>
            Discard
          </Button>
          <Button onClick={vm.handleSave} disabled={vm.isSaving}>
            {vm.isSaving ? "Saving…" : "Save template"}
          </Button>
        </div>
      </div>

      {vm.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {vm.error}
        </p>
      )}

      <div className="grid items-start gap-[18px] md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <TemplateEditorForm
          name={vm.name}
          subject={vm.subject}
          body={vm.body}
          signature={vm.signature}
          onNameChange={vm.setName}
          onSubjectChange={vm.setSubject}
          onBodyChange={vm.setBody}
          onSignatureChange={vm.setSignature}
          nameError={vm.errors.name}
          bodyError={vm.errors.body}
        />
        <div className="rounded-[10px] border bg-card">
          <div className="flex items-center justify-between border-b px-[18px] py-[14px]">
            <span className="text-sm font-semibold text-foreground">Preview</span>
            <span className="text-[11px] text-muted-foreground">Live · sample data</span>
          </div>
          <div className="bg-muted/40 p-[18px]">
            <EmailPreview
              senderName={vm.preview.senderName}
              recipientEmail={vm.preview.recipientEmail}
              subject={vm.preview.subject}
              bodyHtml={vm.preview.bodyHtml}
              signatureHtml={vm.preview.signatureHtml}
              hasPaymentLink={vm.preview.hasPaymentLink}
            />
          </div>
        </div>
      </div>

      <AiDraftBubble
        description={vm.aiDescription}
        onDescriptionChange={vm.setAiDescription}
        onGenerate={vm.handleGenerate}
        isGenerating={vm.isGenerating}
      />
    </div>
  );
}
