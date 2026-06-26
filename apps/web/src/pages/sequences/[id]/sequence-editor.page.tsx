import { useSequenceEditorViewModel } from "./sequence-editor.view-model";
import { StepSpineEditor } from "@/components/sequences/step-spine-editor";
import { AudiencePicker } from "@/components/sequences/audience-picker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function SequenceEditorPage() {
  const vm = useSequenceEditorViewModel();
  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6 px-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">New sequence</h1>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={vm.cancel}>Cancel</Button>
          <Button onClick={vm.save} disabled={!vm.canSave || vm.isSaving}>
            {vm.isSaving ? "Creating…" : "Create sequence"}
          </Button>
        </div>
      </div>

      <div className="max-w-md space-y-1.5">
        <Label htmlFor="seq-name">Sequence name</Label>
        <Input id="seq-name" value={vm.name} onChange={(e) => vm.setName(e.target.value)} placeholder="e.g. Standard reminders" />
        {vm.errors.name && <p className="text-sm text-destructive">{vm.errors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label>Steps</Label>
        {vm.errors.steps && <p className="text-sm text-destructive">{vm.errors.steps}</p>}
        <StepSpineEditor
          rows={vm.rows} templates={vm.templates} hasNoTemplates={vm.hasNoTemplates}
          onAdd={vm.addStep} onEdit={vm.editStep} onDone={vm.doneStep} onRemove={vm.removeStep}
          onTemplate={vm.setStepTemplate} onChannel={vm.setStepChannel} onDelay={vm.setStepDelay}
          onToggleOwnerAlert={vm.toggleOwnerAlert} onTogglePaymentLink={vm.togglePaymentLink}
        />
      </div>

      <div className="space-y-2">
        <Label>Who runs this? <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <AudiencePicker
          businessId={vm.businessId}
          onSelectionChange={(selection) => vm.setAudience(selection)}
        />
      </div>

      {vm.error && (
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium text-destructive">{vm.error}</p>
          {vm.createdSequenceId && (
            <Button variant="ghost" size="sm" onClick={vm.skipAudience}>
              Skip to sequences
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
