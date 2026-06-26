import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Mail, Smartphone, MailOpen, FileText, Users, X, AlertTriangle } from "lucide-react";
import { useSequenceDetailViewModel } from "./sequence-detail.view-model";
import { useTemplates } from "@/queries/use-templates";
import { useEnrollInvoices, useAttachCustomer } from "@/queries/use-sequences";
import { AudiencePicker } from "@/components/sequences/audience-picker";
import { SequenceStatusBadge } from "@/components/sequences/sequence-status-badge";
import {
  ListCard,
  ListCardHeader,
  ListRow,
  ListSkeletonCard,
  ListMessageCard,
} from "@/components/common/list-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { AudienceSelection, AudienceSummary } from "@/components/sequences/use-audience-picker";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ChannelIcon({ channel }: { channel: "email" | "sms" | "email_and_sms" }) {
  if (channel === "email") return <Mail className="h-4 w-4" />;
  if (channel === "sms") return <Smartphone className="h-4 w-4" />;
  return <MailOpen className="h-4 w-4" />;
}

function channelLabel(channel: "email" | "sms" | "email_and_sms"): string {
  if (channel === "email") return "Email";
  if (channel === "sms") return "SMS";
  return "Email + SMS";
}

function RunStatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, " ").toLowerCase();
  if (status === "active") {
    return (
      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 text-[11px]">
        {label}
      </Badge>
    );
  }
  if (status === "paused" || status === "stopped" || status === "completed") {
    return (
      <Badge variant="outline" className="text-muted-foreground text-[11px]">
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[11px]">
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Confirm detach customer dialog
// ---------------------------------------------------------------------------

interface DetachCustomerDialogProps {
  customerName: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  isRemoving: boolean;
}

function DetachCustomerDialog({
  customerName,
  onCancel,
  onConfirm,
  isRemoving,
}: DetachCustomerDialogProps) {
  return (
    <Dialog open={customerName !== null} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove customer from sequence?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This will stop all active runs for{" "}
          <span className="font-semibold text-foreground">{customerName}</span> and detach them from
          this sequence. Their override will be cleared.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isRemoving}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isRemoving}>
            {isRemoving ? "Removing…" : "Remove customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Confirm stop run dialog
// ---------------------------------------------------------------------------

interface StopRunDialogProps {
  invoiceNumber: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  isStopping: boolean;
}

function StopRunDialog({
  invoiceNumber,
  onCancel,
  onConfirm,
  isStopping,
}: StopRunDialogProps) {
  return (
    <Dialog open={invoiceNumber !== null} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stop this follow-up?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Invoice{" "}
          <span className="font-semibold text-foreground">{invoiceNumber}</span> will stop
          receiving reminders.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isStopping}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isStopping}>
            {isStopping ? "Stopping…" : "Stop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function SequenceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const sequenceId = id ?? "";

  const vm = useSequenceDetailViewModel(sequenceId);

  const businessId = vm.businessId;

  // Template name resolution
  const templatesQuery = useTemplates(businessId);
  const templateMap = new Map(
    (templatesQuery.data?.data ?? []).map((t) => [t.id, t.name]),
  );

  // Enroll / attach mutations for the Audience tab
  const enrollMut = useEnrollInvoices();
  const attachMut = useAttachCustomer();

  // Audience picker selection state
  const [audienceSelection, setAudienceSelection] = useState<AudienceSelection | null>(null);
  const [audienceSummary, setAudienceSummary] = useState<AudienceSummary | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [isAttaching, setIsAttaching] = useState(false);

  // Detach customer confirm dialog
  const [confirmDetachCustomer, setConfirmDetachCustomer] = useState<{
    customerId: string;
    customerName: string;
  } | null>(null);
  const [isDetaching, setIsDetaching] = useState(false);

  // Stop run (remove invoice) confirm dialog
  const [confirmStopRun, setConfirmStopRun] = useState<{
    runId: string;
    invoiceNumber: string;
  } | null>(null);
  const [isStopping, setIsStopping] = useState(false);

  function handleSelectionChange(sel: AudienceSelection, summary: AudienceSummary) {
    setAudienceSelection(sel);
    setAudienceSummary(summary);
  }

  async function handleAttach() {
    if (!audienceSelection || !businessId) return;
    setAttachError(null);
    setIsAttaching(true);
    try {
      if (audienceSelection.mode === "invoices") {
        await enrollMut.mutateAsync({
          sequenceId: sequenceId,
          businessId,
          invoiceIds: audienceSelection.invoiceIds,
        });
      } else {
        for (const customerId of audienceSelection.customerIds) {
          await attachMut.mutateAsync({
            sequenceId: sequenceId,
            businessId,
            customerId,
          });
        }
      }
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : "Failed to attach audience.");
    } finally {
      setIsAttaching(false);
    }
  }

  const hasAudienceSelection =
    audienceSelection !== null &&
    ((audienceSelection.mode === "invoices" && audienceSelection.invoiceIds.length > 0) ||
      (audienceSelection.mode === "customer" && audienceSelection.customerIds.length > 0));

  if (vm.isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1100px] space-y-6 px-6 py-6">
        <ListSkeletonCard rows={3} />
      </div>
    );
  }

  if (vm.error && !vm.name) {
    return (
      <div className="mx-auto w-full max-w-[1100px] px-6 py-6">
        <ListMessageCard>
          <p className="text-sm text-destructive">{vm.error}</p>
        </ListMessageCard>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6 px-6 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-muted-foreground">
            <button
              onClick={() => navigate("/sequences")}
              className="hover:text-foreground transition-colors"
            >
              Sequences
            </button>
            {" / "}
            <span className="font-semibold text-foreground">{vm.name || "—"}</span>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{vm.name}</h1>
            <SequenceStatusBadge isActive={vm.isActive} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {vm.isActive ? (
            <Button
              variant="outline"
              onClick={vm.pause}
              disabled={vm.isPausing || vm.isActivating}
            >
              Pause
            </Button>
          ) : (
            <Button
              onClick={vm.activate}
              disabled={vm.isPausing || vm.isActivating}
            >
              Activate
            </Button>
          )}
        </div>
      </div>

      {/* Inline error from VM (pause/activate/remove errors) */}
      {vm.error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {vm.error}
        </div>
      )}

      {/* Tabs */}
      <Tabs
        value={vm.tab}
        onValueChange={(v) => vm.setTab(v as "flow" | "audience")}
      >
        <TabsList>
          <TabsTrigger value="flow">Flow</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
        </TabsList>

        {/* ── Flow tab ── */}
        <TabsContent value="flow" className="space-y-4">
          {!vm.canEditSteps && (
            <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
              Pause the sequence to edit steps.
            </div>
          )}

          {vm.stepRows.length === 0 ? (
            <ListMessageCard>
              <p className="text-center text-sm text-muted-foreground">No steps defined yet.</p>
            </ListMessageCard>
          ) : (
            <ListCard>
              <ListCardHeader label="Steps" count={vm.stepRows.length} noun="step" />
              {vm.stepRows.map((step) => {
                const resolvedName = step.templateId
                  ? (templateMap.get(step.templateId) ?? `Template · ${step.templateId}`)
                  : step.templateName;
                return (
                  <ListRow
                    key={step.key}
                    icon={<ChannelIcon channel={step.channel} />}
                    title={`Day ${step.displayDay} · ${channelLabel(step.channel)}`}
                    subtitle={resolvedName}
                  />
                );
              })}
            </ListCard>
          )}
        </TabsContent>

        {/* ── Audience tab ── */}
        <TabsContent value="audience" className="space-y-6">
          {/* Running now */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-foreground">Running now</div>

            {vm.runRows.length === 0 ? (
              <ListMessageCard>
                <p className="text-center text-sm text-muted-foreground">
                  No invoices running this sequence.
                </p>
              </ListMessageCard>
            ) : (
              <ListCard>
                <ListCardHeader
                  label="Active invoices"
                  count={vm.runRows.length}
                  noun="invoice"
                />
                {vm.runRows.map((run) => (
                  <ListRow
                    key={run.runId}
                    icon={<FileText className="h-4 w-4" />}
                    title={run.customerName}
                    subtitle={
                      <span className="flex items-center gap-2">
                        <span>{run.invoiceNumber}</span>
                        <span className="font-semibold tabular-nums text-destructive">
                          {run.amountText}
                        </span>
                        <RunStatusBadge status={run.runStatus} />
                      </span>
                    }
                    right={
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove customer ${run.customerName} from sequence`}
                          onClick={() =>
                            setConfirmDetachCustomer({
                              customerId: run.customerId,
                              customerName: run.customerName,
                            })
                          }
                          title={`Remove ${run.customerName} from sequence`}
                        >
                          <Users className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Stop run for invoice ${run.invoiceNumber}`}
                          onClick={() =>
                            setConfirmStopRun({
                              runId: run.runId,
                              invoiceNumber: run.invoiceNumber,
                            })
                          }
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    }
                  />
                ))}
              </ListCard>
            )}
          </div>

          {/* Add audience */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-foreground">Add to this sequence</div>
            <AudiencePicker
              businessId={businessId}
              onSelectionChange={handleSelectionChange}
            />
            {attachError && (
              <p className="text-sm text-destructive">{attachError}</p>
            )}
            <Button
              disabled={!hasAudienceSelection || isAttaching}
              onClick={() => void handleAttach()}
              className="w-full sm:w-auto"
            >
              {isAttaching
                ? "Attaching…"
                : audienceSummary && hasAudienceSelection
                  ? audienceSelection?.mode === "invoices"
                    ? `Attach ${audienceSummary.invoiceCount} invoice${audienceSummary.invoiceCount === 1 ? "" : "s"}`
                    : `Attach ${audienceSummary.customerCount} customer${audienceSummary.customerCount === 1 ? "" : "s"}`
                  : "Attach"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Detach customer confirm dialog */}
      <DetachCustomerDialog
        customerName={confirmDetachCustomer?.customerName ?? null}
        onCancel={() => setConfirmDetachCustomer(null)}
        isRemoving={isDetaching}
        onConfirm={async () => {
          if (!confirmDetachCustomer) return;
          setIsDetaching(true);
          await vm.removeCustomer(confirmDetachCustomer.customerId);
          setIsDetaching(false);
          setConfirmDetachCustomer(null);
        }}
      />

      {/* Stop run (remove invoice) confirm dialog */}
      <StopRunDialog
        invoiceNumber={confirmStopRun?.invoiceNumber ?? null}
        onCancel={() => setConfirmStopRun(null)}
        isStopping={isStopping}
        onConfirm={async () => {
          if (!confirmStopRun) return;
          setIsStopping(true);
          await vm.removeInvoice(confirmStopRun.runId);
          setIsStopping(false);
          setConfirmStopRun(null);
        }}
      />
    </div>
  );
}
