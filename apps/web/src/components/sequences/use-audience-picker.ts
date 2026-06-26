import { useState, useMemo, useCallback } from "react";
import { useCustomers } from "@/queries/use-customers";
import { useCustomerOverdueInvoices } from "@/queries/use-invoices";
import type { CustomerListItem } from "@/api/customers.api";
import type { InvoiceListItem } from "@/api/invoices.api";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type AudienceMode = "customer" | "invoices";

export type AudienceSelection =
  | { mode: "customer"; customerIds: string[] }
  | { mode: "invoices"; invoiceIds: string[] };

export interface AudienceSummary {
  /** Distinct customers represented by the current selection */
  customerCount: number;
  /** Selected invoices (invoices mode); 0 in customer mode */
  invoiceCount: number;
  /** Sum of selected invoice amountCents (invoices mode); 0 in customer mode */
  totalCents: number;
}

/** Minimal invoice data needed for selection tracking in invoices mode. */
export interface SelectedInvoiceRef {
  id: string;
  customerId: string;
  amountCents: number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAudiencePicker(businessId: string) {
  // ---- core state ----
  const [mode, setModeState] = useState<AudienceMode>("customer");
  const [search, setSearch] = useState<string>("");
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);

  // customer mode selection — a Set of customerIds
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());

  // invoices mode selection — track full refs so we can sum amounts + count distinct customers
  const [selectedInvoices, setSelectedInvoices] = useState<Map<string, SelectedInvoiceRef>>(
    new Map(),
  );

  // ---- queries ----
  const customersQuery = useCustomers({ businessId, search: search || undefined, hasOverdue: true });
  const overdueQuery = useCustomerOverdueInvoices(businessId, expandedCustomerId ?? "");

  // ---- mode switching ----
  const setMode = useCallback((newMode: AudienceMode) => {
    setModeState(newMode);
    if (newMode === "invoices") {
      // switching TO invoices → clear customer selection
      setSelectedCustomerIds(new Set());
    } else {
      // switching TO customer → clear invoice selection
      setSelectedInvoices(new Map());
    }
  }, []);

  // ---- customer mode actions ----
  const toggleCustomer = useCallback((customerId: string) => {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  }, []);

  const isCustomerSelected = useCallback(
    (customerId: string) => selectedCustomerIds.has(customerId),
    [selectedCustomerIds],
  );

  // ---- invoices mode actions ----
  const toggleInvoice = useCallback((inv: SelectedInvoiceRef) => {
    setSelectedInvoices((prev) => {
      const next = new Map(prev);
      if (next.has(inv.id)) {
        next.delete(inv.id);
      } else {
        next.set(inv.id, inv);
      }
      return next;
    });
  }, []);

  const isInvoiceSelected = useCallback(
    (invoiceId: string) => selectedInvoices.has(invoiceId),
    [selectedInvoices],
  );

  // ---- expand/collapse ----
  const toggleExpand = useCallback((customerId: string) => {
    setExpandedCustomerId((prev) => (prev === customerId ? null : customerId));
  }, []);

  // ---- reset ----
  const reset = useCallback(() => {
    setModeState("customer");
    setSearch("");
    setExpandedCustomerId(null);
    setSelectedCustomerIds(new Set());
    setSelectedInvoices(new Map());
  }, []);

  // ---- derived: selection ----
  const selection = useMemo<AudienceSelection>(() => {
    if (mode === "customer") {
      return { mode: "customer", customerIds: Array.from(selectedCustomerIds) };
    }
    return { mode: "invoices", invoiceIds: Array.from(selectedInvoices.keys()) };
  }, [mode, selectedCustomerIds, selectedInvoices]);

  // ---- derived: summary ----
  const summary = useMemo<AudienceSummary>(() => {
    if (mode === "customer") {
      return {
        customerCount: selectedCustomerIds.size,
        invoiceCount: 0,
        totalCents: 0,
      };
    }
    // invoices mode
    const invoiceRefs = Array.from(selectedInvoices.values());
    const distinctCustomers = new Set(invoiceRefs.map((inv) => inv.customerId));
    const totalCents = invoiceRefs.reduce((sum, inv) => sum + inv.amountCents, 0);
    return {
      customerCount: distinctCustomers.size,
      invoiceCount: invoiceRefs.length,
      totalCents,
    };
  }, [mode, selectedCustomerIds, selectedInvoices]);

  // ---- derived: hasSelection ----
  const hasSelection = useMemo(
    () => (mode === "customer" ? selectedCustomerIds.size > 0 : selectedInvoices.size > 0),
    [mode, selectedCustomerIds, selectedInvoices],
  );

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------
  return {
    // mode
    mode,
    setMode,

    // search
    search,
    setSearch,

    // customers query
    customers: (customersQuery.data?.data ?? []) as CustomerListItem[],
    customersLoading: customersQuery.isLoading,

    // expand / overdue invoices query
    expandedCustomerId,
    toggleExpand,
    overdueInvoices: (overdueQuery.data?.data ?? []) as InvoiceListItem[],
    overdueLoading: overdueQuery.isLoading,

    // customer mode
    isCustomerSelected,
    toggleCustomer,

    // invoices mode
    isInvoiceSelected,
    toggleInvoice,

    // derived
    selection,
    summary,
    hasSelection,

    // reset
    reset,
  };
}
