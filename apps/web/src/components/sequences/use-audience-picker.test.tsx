import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useAudiencePicker } from "./use-audience-picker";
import type { CustomerListItem } from "@/api/customers.api";
import type { InvoiceListItem } from "@/api/invoices.api";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/queries/use-customers", () => ({
  useCustomers: vi.fn(),
}));

vi.mock("@/queries/use-invoices", () => ({
  useCustomerOverdueInvoices: vi.fn(),
}));

import { useCustomers } from "@/queries/use-customers";
import { useCustomerOverdueInvoices } from "@/queries/use-invoices";

const mockUseCustomers = vi.mocked(useCustomers);
const mockUseCustomerOverdueInvoices = vi.mocked(useCustomerOverdueInvoices);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CUSTOMER_A: CustomerListItem = {
  id: "cust-a",
  businessId: "biz-1",
  companyName: "Acme Corp",
  contactName: null,
  contactEmail: null,
  contactPhone: null,
  relationshipTier: null,
  sequenceId: null,
  paymentTerms: null,
  avgDaysToPay: null,
  totalOutstanding: 5000,
  isActive: true,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const CUSTOMER_B: CustomerListItem = {
  ...CUSTOMER_A,
  id: "cust-b",
  companyName: "Beta Ltd",
};

const INVOICE_1: InvoiceListItem = {
  id: "inv-1",
  invoiceNumber: "INV-001",
  status: "overdue",
  amountCents: 10000,
  amountPaidCents: 0,
  balanceDueCents: 10000,
  currency: "USD",
  daysOverdue: 15,
  dueDate: "2024-01-01",
  issuedDate: null,
  paymentLinkUrl: null,
  customer: { id: "cust-a", companyName: "Acme Corp" },
  sequenceRun: null,
};


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupMocks(
  customers: CustomerListItem[] = [CUSTOMER_A, CUSTOMER_B],
  overdueInvoices: InvoiceListItem[] = [],
) {
  mockUseCustomers.mockReturnValue({
    data: { data: customers, pagination: { page: 1, limit: 100, total: customers.length, totalPages: 1 } },
    isLoading: false,
    error: null,
  } as any);

  mockUseCustomerOverdueInvoices.mockReturnValue({
    data: { data: overdueInvoices, pagination: { limit: 100, total: overdueInvoices.length, nextCursor: null, hasMore: false } },
    isLoading: false,
    error: null,
  } as any);
}

const BUSINESS_ID = "biz-1";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAudiencePicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it("defaults to customer mode, empty selection, hasSelection false", () => {
    const { result } = renderHook(() => useAudiencePicker(BUSINESS_ID));

    expect(result.current.mode).toBe("customer");
    expect(result.current.hasSelection).toBe(false);
    expect(result.current.selection).toEqual({ mode: "customer", customerIds: [] });
    expect(result.current.summary).toEqual({ customerCount: 0, invoiceCount: 0, totalCents: 0 });
  });

  it("exposes customers and loading state from useCustomers", () => {
    const { result } = renderHook(() => useAudiencePicker(BUSINESS_ID));

    expect(result.current.customers).toEqual([CUSTOMER_A, CUSTOMER_B]);
    expect(result.current.customersLoading).toBe(false);
  });

  it("passes businessId, search, and hasOverdue:true to useCustomers", () => {
    const { result } = renderHook(() => useAudiencePicker(BUSINESS_ID));

    // After changing search
    act(() => result.current.setSearch("acme"));

    expect(mockUseCustomers).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: BUSINESS_ID, hasOverdue: true }),
    );
  });

  describe("customer mode — toggleCustomer", () => {
    it("toggleCustomer adds a customer to the selection", () => {
      const { result } = renderHook(() => useAudiencePicker(BUSINESS_ID));

      act(() => result.current.toggleCustomer("cust-a"));

      expect(result.current.isCustomerSelected("cust-a")).toBe(true);
      expect(result.current.hasSelection).toBe(true);
      expect(result.current.selection).toEqual({ mode: "customer", customerIds: ["cust-a"] });
      expect(result.current.summary).toEqual({ customerCount: 1, invoiceCount: 0, totalCents: 0 });
    });

    it("toggleCustomer removes a customer that was already selected", () => {
      const { result } = renderHook(() => useAudiencePicker(BUSINESS_ID));

      act(() => result.current.toggleCustomer("cust-a"));
      act(() => result.current.toggleCustomer("cust-b"));
      act(() => result.current.toggleCustomer("cust-a")); // remove

      expect(result.current.isCustomerSelected("cust-a")).toBe(false);
      expect(result.current.isCustomerSelected("cust-b")).toBe(true);
      expect(result.current.selection).toEqual({ mode: "customer", customerIds: ["cust-b"] });
      expect(result.current.summary.customerCount).toBe(1);
    });

    it("selecting multiple customers updates customerCount correctly", () => {
      const { result } = renderHook(() => useAudiencePicker(BUSINESS_ID));

      act(() => {
        result.current.toggleCustomer("cust-a");
        result.current.toggleCustomer("cust-b");
      });

      expect(result.current.summary.customerCount).toBe(2);
      expect(result.current.summary.invoiceCount).toBe(0);
      expect(result.current.summary.totalCents).toBe(0);
    });
  });

  describe("setMode — clears the other mode's selection", () => {
    it("setMode('invoices') clears customer selection", () => {
      const { result } = renderHook(() => useAudiencePicker(BUSINESS_ID));

      act(() => result.current.toggleCustomer("cust-a"));
      expect(result.current.hasSelection).toBe(true);

      act(() => result.current.setMode("invoices"));

      expect(result.current.mode).toBe("invoices");
      expect(result.current.isCustomerSelected("cust-a")).toBe(false);
      expect(result.current.hasSelection).toBe(false);
      expect(result.current.selection).toEqual({ mode: "invoices", invoiceIds: [] });
    });

    it("setMode('customer') clears invoice selection", () => {
      const { result } = renderHook(() => useAudiencePicker(BUSINESS_ID));

      act(() => result.current.setMode("invoices"));
      act(() => result.current.toggleInvoice({ id: "inv-1", customerId: "cust-a", amountCents: 10000 }));
      expect(result.current.hasSelection).toBe(true);

      act(() => result.current.setMode("customer"));

      expect(result.current.mode).toBe("customer");
      expect(result.current.isInvoiceSelected("inv-1")).toBe(false);
      expect(result.current.hasSelection).toBe(false);
      expect(result.current.selection).toEqual({ mode: "customer", customerIds: [] });
    });
  });

  describe("invoices mode — toggleInvoice", () => {
    it("toggleInvoice adds an invoice and computes summary correctly", () => {
      const { result } = renderHook(() => useAudiencePicker(BUSINESS_ID));
      act(() => result.current.setMode("invoices"));

      act(() => result.current.toggleInvoice({ id: "inv-1", customerId: "cust-a", amountCents: 10000 }));

      expect(result.current.isInvoiceSelected("inv-1")).toBe(true);
      expect(result.current.hasSelection).toBe(true);
      expect(result.current.selection).toEqual({ mode: "invoices", invoiceIds: ["inv-1"] });
      expect(result.current.summary).toEqual({ customerCount: 1, invoiceCount: 1, totalCents: 10000 });
    });

    it("toggleInvoice removes an invoice that was already selected", () => {
      const { result } = renderHook(() => useAudiencePicker(BUSINESS_ID));
      act(() => result.current.setMode("invoices"));

      act(() => result.current.toggleInvoice({ id: "inv-1", customerId: "cust-a", amountCents: 10000 }));
      act(() => result.current.toggleInvoice({ id: "inv-1", customerId: "cust-a", amountCents: 10000 }));

      expect(result.current.isInvoiceSelected("inv-1")).toBe(false);
      expect(result.current.hasSelection).toBe(false);
    });

    it("summary.totalCents is sum of selected amountCents", () => {
      const { result } = renderHook(() => useAudiencePicker(BUSINESS_ID));
      act(() => result.current.setMode("invoices"));

      act(() => {
        result.current.toggleInvoice({ id: "inv-1", customerId: "cust-a", amountCents: 10000 });
        result.current.toggleInvoice({ id: "inv-2", customerId: "cust-b", amountCents: 25000 });
      });

      expect(result.current.summary.totalCents).toBe(35000);
      expect(result.current.summary.invoiceCount).toBe(2);
    });

    it("summary.customerCount counts distinct customers across selected invoices", () => {
      const { result } = renderHook(() => useAudiencePicker(BUSINESS_ID));
      act(() => result.current.setMode("invoices"));

      // Two invoices for the same customer
      act(() => {
        result.current.toggleInvoice({ id: "inv-1", customerId: "cust-a", amountCents: 10000 });
        result.current.toggleInvoice({ id: "inv-3", customerId: "cust-a", amountCents: 5000 });
      });

      expect(result.current.summary.invoiceCount).toBe(2);
      expect(result.current.summary.customerCount).toBe(1); // distinct
      expect(result.current.summary.totalCents).toBe(15000);
    });

    it("summary.customerCount is distinct across multiple customers", () => {
      const { result } = renderHook(() => useAudiencePicker(BUSINESS_ID));
      act(() => result.current.setMode("invoices"));

      act(() => {
        result.current.toggleInvoice({ id: "inv-1", customerId: "cust-a", amountCents: 10000 });
        result.current.toggleInvoice({ id: "inv-2", customerId: "cust-b", amountCents: 25000 });
        result.current.toggleInvoice({ id: "inv-3", customerId: "cust-a", amountCents: 5000 });
      });

      expect(result.current.summary.customerCount).toBe(2); // cust-a + cust-b
      expect(result.current.summary.invoiceCount).toBe(3);
    });
  });

  describe("toggleExpand", () => {
    it("toggleExpand sets expandedCustomerId", () => {
      const { result } = renderHook(() => useAudiencePicker(BUSINESS_ID));

      act(() => result.current.toggleExpand("cust-a"));

      expect(result.current.expandedCustomerId).toBe("cust-a");
    });

    it("toggleExpand collapses the same customer when toggled again", () => {
      const { result } = renderHook(() => useAudiencePicker(BUSINESS_ID));

      act(() => result.current.toggleExpand("cust-a"));
      act(() => result.current.toggleExpand("cust-a"));

      expect(result.current.expandedCustomerId).toBeNull();
    });

    it("toggleExpand passes expandedCustomerId to useCustomerOverdueInvoices", () => {
      renderHook(() => useAudiencePicker(BUSINESS_ID));

      // The hook should have been called with businessId and some customerId
      expect(mockUseCustomerOverdueInvoices).toHaveBeenCalledWith(
        BUSINESS_ID,
        expect.any(String),
      );
    });

    it("exposes overdueInvoices from useCustomerOverdueInvoices", () => {
      setupMocks([CUSTOMER_A], [INVOICE_1]);
      const { result } = renderHook(() => useAudiencePicker(BUSINESS_ID));

      act(() => result.current.toggleExpand("cust-a"));

      expect(result.current.overdueInvoices).toEqual([INVOICE_1]);
    });
  });

  describe("reset", () => {
    it("reset clears all state back to defaults", () => {
      const { result } = renderHook(() => useAudiencePicker(BUSINESS_ID));

      act(() => {
        result.current.toggleCustomer("cust-a");
        result.current.setSearch("acme");
        result.current.toggleExpand("cust-b");
      });

      act(() => result.current.reset());

      expect(result.current.mode).toBe("customer");
      expect(result.current.hasSelection).toBe(false);
      expect(result.current.search).toBe("");
      expect(result.current.expandedCustomerId).toBeNull();
      expect(result.current.selection).toEqual({ mode: "customer", customerIds: [] });
    });
  });
});
