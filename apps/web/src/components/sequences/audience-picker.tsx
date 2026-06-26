import { useEffect, useLayoutEffect, useRef } from "react";
import { ChevronRight, Users, FileText } from "lucide-react";
import { formatCents } from "@/lib/format";
import {
  useAudiencePicker,
  type AudienceSelection,
  type AudienceSummary,
} from "@/components/sequences/use-audience-picker";
import {
  ListCard,
  ListCardHeader,
  ListRow,
  ListSkeletonCard,
  ListMessageCard,
} from "@/components/common/list-card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AudiencePickerProps {
  businessId: string;
  onSelectionChange?: (selection: AudienceSelection, summary: AudienceSummary) => void;
}

// ---------------------------------------------------------------------------
// Mode toggle
// ---------------------------------------------------------------------------

function ModeToggle({
  mode,
  onSetMode,
}: {
  mode: "customer" | "invoices";
  onSetMode: (m: "customer" | "invoices") => void;
}) {
  return (
    <div className="flex gap-2">
      <Button
        variant={mode === "customer" ? "default" : "outline"}
        size="sm"
        className="flex-1 justify-start gap-2"
        onClick={() => onSetMode("customer")}
      >
        <Users className="h-4 w-4 shrink-0" />
        <span className="text-left leading-tight">
          <span className="block font-semibold">Whole customer</span>
          <span className="block text-[11px] font-normal opacity-75">
            All their overdue invoices
          </span>
        </span>
      </Button>
      <Button
        variant={mode === "invoices" ? "default" : "outline"}
        size="sm"
        className="flex-1 justify-start gap-2"
        onClick={() => onSetMode("invoices")}
      >
        <FileText className="h-4 w-4 shrink-0" />
        <span className="text-left leading-tight">
          <span className="block font-semibold">Specific invoices</span>
          <span className="block text-[11px] font-normal opacity-75">Pick per customer</span>
        </span>
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invoice sub-row (inside expanded customer in invoices mode)
// ---------------------------------------------------------------------------

function InvoiceSubRow({
  invoiceId,
  customerId,
  invoiceNumber,
  daysOverdue,
  amountCents,
  isSelected,
  onToggle,
}: {
  invoiceId: string;
  customerId: string;
  invoiceNumber: string | null;
  daysOverdue: number;
  amountCents: number;
  isSelected: boolean;
  onToggle: (ref: { id: string; customerId: string; amountCents: number }) => void;
}) {
  return (
    <div
      className="flex items-center gap-3 border-b bg-muted/30 px-[18px] py-[11px] last:border-b-0"
      onClick={() => onToggle({ id: invoiceId, customerId, amountCents })}
    >
      <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggle({ id: invoiceId, customerId, amountCents })}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select invoice ${invoiceNumber ?? invoiceId}`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{invoiceNumber ?? "—"}</div>
        <div className="text-[12px] text-muted-foreground">
          {daysOverdue > 0 ? `${daysOverdue}d overdue` : "Due soon"}
        </div>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-destructive">
        {formatCents(amountCents)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overdue loading sub-rows (skeleton)
// ---------------------------------------------------------------------------

function OverdueLoadingRows() {
  return (
    <div className="border-b bg-muted/30 px-[18px] py-3">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="mb-2 h-8 animate-pulse rounded-md bg-muted last:mb-0" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

function SummaryCard({
  mode,
  hasSelection,
  customerCount,
  invoiceCount,
  totalCents,
}: {
  mode: "customer" | "invoices";
  hasSelection: boolean;
  customerCount: number;
  invoiceCount: number;
  totalCents: number;
}) {
  if (!hasSelection) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
        No audience selected yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-foreground">
      {mode === "customer" ? (
        <span>
          Will attach{" "}
          <span className="font-semibold">
            {customerCount} customer{customerCount === 1 ? "" : "s"}
          </span>{" "}
          — their overdue invoices start chasing.
        </span>
      ) : (
        <span>
          Will start chasing{" "}
          <span className="font-semibold">
            {invoiceCount} invoice{invoiceCount === 1 ? "" : "s"}
          </span>{" "}
          ·{" "}
          <span className="font-semibold tabular-nums text-destructive">
            {formatCents(totalCents)}
          </span>{" "}
          across{" "}
          <span className="font-semibold">
            {customerCount} customer{customerCount === 1 ? "" : "s"}
          </span>
          .
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AudiencePicker({ businessId, onSelectionChange }: AudiencePickerProps) {
  const hook = useAudiencePicker(businessId);

  // Notify parent whenever selection or summary changes
  const onSelectionChangeRef = useRef(onSelectionChange);
  useLayoutEffect(() => { onSelectionChangeRef.current = onSelectionChange; });
  useEffect(() => {
    onSelectionChangeRef.current?.(hook.selection, hook.summary);
  }, [hook.selection, hook.summary]);

  return (
    <div className="flex flex-col gap-4">
      {/* Mode toggle */}
      <ModeToggle mode={hook.mode} onSetMode={hook.setMode} />

      {/* Search */}
      <Input
        placeholder="Search customers…"
        value={hook.search}
        onChange={(e) => hook.setSearch(e.target.value)}
        className="h-9"
      />

      {/* Customer list */}
      {hook.customersLoading ? (
        <ListSkeletonCard rows={3} />
      ) : hook.customers.length === 0 ? (
        <ListMessageCard>
          <p className="text-center text-sm text-muted-foreground">
            No customers with overdue invoices.
          </p>
        </ListMessageCard>
      ) : (
        <ListCard>
          <ListCardHeader
            label="Customers with overdue"
            count={hook.customers.length}
            noun="customer"
          />
          {hook.customers.map((customer) => {
            const isExpanded = hook.expandedCustomerId === customer.id;

            const subtitle = customer.relationshipTier
              ? customer.relationshipTier.name
              : customer.totalOutstanding > 0
                ? formatCents(customer.totalOutstanding)
                : "No outstanding balance";

            return (
              <div key={customer.id}>
                <ListRow
                  icon={<Users className="h-4 w-4" />}
                  title={customer.companyName}
                  subtitle={subtitle}
                  onClick={
                    hook.mode === "invoices" ? () => hook.toggleExpand(customer.id) : undefined
                  }
                  right={
                    hook.mode === "customer" ? (
                      <Checkbox
                        checked={hook.isCustomerSelected(customer.id)}
                        onCheckedChange={() => hook.toggleCustomer(customer.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${customer.companyName}`}
                      />
                    ) : (
                      <span
                        className={cn(
                          "text-muted-foreground transition-transform duration-150",
                          isExpanded && "rotate-90",
                        )}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    )
                  }
                />

                {/* Expanded invoice checklist (invoices mode only) */}
                {hook.mode === "invoices" && isExpanded && (
                  <>
                    {hook.overdueLoading ? (
                      <OverdueLoadingRows />
                    ) : hook.overdueInvoices.length === 0 ? (
                      <div className="border-b bg-muted/30 px-[18px] py-3 text-sm text-muted-foreground last:border-b-0">
                        No overdue invoices.
                      </div>
                    ) : (
                      hook.overdueInvoices.map((inv) => (
                        <InvoiceSubRow
                          key={inv.id}
                          invoiceId={inv.id}
                          customerId={customer.id}
                          invoiceNumber={inv.invoiceNumber}
                          daysOverdue={inv.daysOverdue}
                          amountCents={inv.amountCents}
                          isSelected={hook.isInvoiceSelected(inv.id)}
                          onToggle={hook.toggleInvoice}
                        />
                      ))
                    )}
                  </>
                )}
              </div>
            );
          })}
        </ListCard>
      )}

      {/* Summary */}
      <SummaryCard
        mode={hook.mode}
        hasSelection={hook.hasSelection}
        customerCount={hook.summary.customerCount}
        invoiceCount={hook.summary.invoiceCount}
        totalCents={hook.summary.totalCents}
      />
    </div>
  );
}
