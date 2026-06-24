import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTemplatesViewModel } from "./templates.view-model";
import { TemplateList } from "../../components/templates/template-list";
import { DeleteTemplateDialog } from "../../components/templates/delete-template-dialog";

export function TemplatesPage() {
  const vm = useTemplatesViewModel();

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 px-6 py-6 lg:px-10">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">Reusable emails for your follow-ups.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={vm.goToNew}>
            <Sparkles className="mr-1.5 h-4 w-4" />
            Draft with AI
          </Button>
          <Button onClick={vm.goToNew}>+ New template</Button>
        </div>
      </div>

      <TemplateList
        rows={vm.rows}
        isLoading={vm.isLoading}
        error={vm.error}
        onNew={vm.goToNew}
        onDraftWithAI={vm.goToNew}
        onEdit={vm.goToEdit}
        onDuplicate={vm.duplicateById}
        onDelete={vm.openDelete}
        onRetry={vm.refetch}
      />

      <DeleteTemplateDialog
        target={vm.deleteTarget}
        isDeleting={vm.isDeleting}
        onCancel={vm.closeDelete}
        onConfirm={vm.confirmDelete}
      />
    </div>
  );
}
