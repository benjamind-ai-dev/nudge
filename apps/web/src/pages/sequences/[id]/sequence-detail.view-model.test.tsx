import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useSequenceDetailViewModel } from "./sequence-detail.view-model";

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/hooks/use-active-business-id", () => ({
  useActiveBusinessId: () => ({ businessId: "biz-1", isLoading: false, hasMultiple: false }),
}));

const mockPauseMutate = vi.fn();
const mockActivateMutate = vi.fn();
const mockStopRunMutate = vi.fn();
const mockDetachMutate = vi.fn();
const mockReplaceMutate = vi.fn();

vi.mock("@/queries/use-sequences", () => ({
  useSequence: vi.fn(),
  usePauseSequence: () => ({ mutateAsync: mockPauseMutate, isPending: false }),
  useActivateSequence: () => ({ mutateAsync: mockActivateMutate, isPending: false }),
  useDetachCustomer: () => ({ mutateAsync: mockDetachMutate, isPending: false }),
  useReplaceSequence: () => ({ mutateAsync: mockReplaceMutate, isPending: false }),
}));

vi.mock("./use-step-draft", () => ({
  useStepDraft: () => ({
    steps: [],
    rows: [],
    activeStepKey: null,
    addStep: vi.fn(),
    removeStep: vi.fn(),
    moveStep: vi.fn(),
    editStep: vi.fn(),
    doneStep: vi.fn(),
    isStepComplete: vi.fn(),
    setStepTemplate: vi.fn(),
    setStepChannel: vi.fn(),
    setStepDelay: vi.fn(),
    toggleOwnerAlert: vi.fn(),
    togglePaymentLink: vi.fn(),
    templates: [],
    templatesLoading: false,
    hasNoTemplates: true,
    allStepsComplete: false,
    buildPayload: () => [],
    seed: vi.fn(),
  }),
  draftStepFromDetail: vi.fn(),
}));

vi.mock("@/queries/use-sequence-runs", () => ({
  useSequenceRuns: vi.fn(),
  useStopSequenceRun: () => ({ mutateAsync: mockStopRunMutate, isPending: false }),
}));

// ── helpers ───────────────────────────────────────────────────────────────────

import { useSequence } from "@/queries/use-sequences";
import { useSequenceRuns } from "@/queries/use-sequence-runs";

const mockUseSequence = vi.mocked(useSequence);
const mockUseSequenceRuns = vi.mocked(useSequenceRuns);

function makeStep(overrides: {
  id?: string;
  stepOrder?: number;
  delayDays?: number;
  channel?: "email" | "sms" | "email_and_sms";
  templateId?: string | null;
}) {
  return {
    id: overrides.id ?? "step-1",
    stepOrder: overrides.stepOrder ?? 1,
    delayDays: overrides.delayDays ?? 0,
    channel: overrides.channel ?? ("email" as const),
    templateId: overrides.templateId ?? null,
    bodyTemplate: "Hello {{customerName}}",
    subjectTemplate: "Invoice reminder",
    smsBodyTemplate: null,
    isOwnerAlert: false,
    includePaymentLink: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };
}

function makeSequence(overrides: {
  steps?: ReturnType<typeof makeStep>[];
  activeRuns?: number;
  isActive?: boolean;
  name?: string;
}) {
  return {
    data: {
      id: "seq-1",
      businessId: "biz-1",
      name: overrides.name ?? "Test Sequence",
      isActive: overrides.isActive ?? true,
      stepCount: (overrides.steps ?? []).length,
      activeRuns: overrides.activeRuns ?? 0,
      relationshipTier: null,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      inUse: false,
      inUseReason: null,
      steps: overrides.steps ?? [],
    },
  };
}

function makeRun(overrides: {
  id?: string;
  status?: "active" | "paused" | "stopped" | "completed";
  customerId?: string;
  companyName?: string;
  invoiceNumber?: string | null;
  amountCents?: number;
  invoiceStatus?: string;
}) {
  return {
    id: overrides.id ?? "run-1",
    status: overrides.status ?? ("active" as const),
    pausedReason: null,
    stoppedReason: null,
    nextSendAt: null,
    startedAt: "2024-01-01T00:00:00Z",
    completedAt: null,
    invoice: {
      id: "inv-1",
      invoiceNumber: "invoiceNumber" in overrides ? overrides.invoiceNumber : "INV-001",
      amountCents: overrides.amountCents ?? 10000,
      balanceDueCents: overrides.amountCents ?? 10000,
      status: overrides.invoiceStatus ?? "OVERDUE",
    },
    customer: {
      id: overrides.customerId ?? "cust-1",
      companyName: overrides.companyName ?? "Acme Corp",
    },
    currentStep: null,
  };
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

beforeEach(() => {
  mockPauseMutate.mockReset();
  mockActivateMutate.mockReset();
  mockStopRunMutate.mockReset();
  mockDetachMutate.mockReset();
  mockReplaceMutate.mockReset();

  // Default: empty/loading state
  mockUseSequence.mockReturnValue({
    data: undefined,
    isLoading: true,
    error: null,
    refetch: vi.fn(),
  } as any);

  mockUseSequenceRuns.mockReturnValue({
    data: undefined,
    isLoading: true,
    error: null,
  } as any);
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe("useSequenceDetailViewModel", () => {
  describe("stepRows — cumulative day mapping", () => {
    it("computes cumulative displayDay from step delayDays (delays [0,3,4] → days [0,3,7])", () => {
      mockUseSequence.mockReturnValue({
        data: makeSequence({
          steps: [
            makeStep({ id: "s1", stepOrder: 1, delayDays: 0, channel: "email" }),
            makeStep({ id: "s2", stepOrder: 2, delayDays: 3, channel: "sms" }),
            makeStep({ id: "s3", stepOrder: 3, delayDays: 4, channel: "email" }),
          ],
        }),
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
      mockUseSequenceRuns.mockReturnValue({ data: undefined, isLoading: false, error: null } as any);

      const { result } = renderHook(() => useSequenceDetailViewModel("seq-1"), { wrapper });

      expect(result.current.stepRows).toHaveLength(3);
      expect(result.current.stepRows.map((r) => r.displayDay)).toEqual([0, 3, 7]);
    });

    it("sets channel and delayDays on each row", () => {
      mockUseSequence.mockReturnValue({
        data: makeSequence({
          steps: [
            makeStep({ id: "s1", stepOrder: 1, delayDays: 0, channel: "email" }),
            makeStep({ id: "s2", stepOrder: 2, delayDays: 5, channel: "sms" }),
          ],
        }),
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
      mockUseSequenceRuns.mockReturnValue({ data: undefined, isLoading: false, error: null } as any);

      const { result } = renderHook(() => useSequenceDetailViewModel("seq-1"), { wrapper });

      expect(result.current.stepRows[0]).toMatchObject({ channel: "email", delayDays: 0 });
      expect(result.current.stepRows[1]).toMatchObject({ channel: "sms", delayDays: 5 });
    });

    it("returns empty stepRows when sequence has no steps", () => {
      mockUseSequence.mockReturnValue({
        data: makeSequence({ steps: [] }),
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
      mockUseSequenceRuns.mockReturnValue({ data: undefined, isLoading: false, error: null } as any);

      const { result } = renderHook(() => useSequenceDetailViewModel("seq-1"), { wrapper });

      expect(result.current.stepRows).toHaveLength(0);
    });

    it("includes templateId as templateName when no named template is available", () => {
      mockUseSequence.mockReturnValue({
        data: makeSequence({
          steps: [makeStep({ id: "s1", stepOrder: 1, delayDays: 0, templateId: "tmpl-abc" })],
        }),
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
      mockUseSequenceRuns.mockReturnValue({ data: undefined, isLoading: false, error: null } as any);

      const { result } = renderHook(() => useSequenceDetailViewModel("seq-1"), { wrapper });

      // templateName should be non-empty even when only templateId is present
      expect(result.current.stepRows[0].templateName).toBeTruthy();
    });
  });

  describe("runRows — mapping and formatting", () => {
    it("maps runs to runRows with formatted amountText and correct names", () => {
      mockUseSequence.mockReturnValue({
        data: makeSequence({}),
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
      mockUseSequenceRuns.mockReturnValue({
        data: {
          data: [
            makeRun({
              id: "run-1",
              customerId: "cust-1",
              companyName: "Acme Corp",
              invoiceNumber: "INV-001",
              amountCents: 150000,
              invoiceStatus: "OVERDUE",
              status: "active",
            }),
          ],
        },
        isLoading: false,
        error: null,
      } as any);

      const { result } = renderHook(() => useSequenceDetailViewModel("seq-1"), { wrapper });

      expect(result.current.runRows).toHaveLength(1);
      const row = result.current.runRows[0];
      expect(row.runId).toBe("run-1");
      expect(row.customerId).toBe("cust-1");
      expect(row.customerName).toBe("Acme Corp");
      expect(row.invoiceNumber).toBe("INV-001");
      expect(row.amountText).toBe("$1,500.00");
      expect(row.invoiceStatus).toBe("OVERDUE");
      expect(row.runStatus).toBe("active");
    });

    it("uses '—' for missing invoiceNumber", () => {
      mockUseSequence.mockReturnValue({
        data: makeSequence({}),
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
      mockUseSequenceRuns.mockReturnValue({
        data: {
          data: [makeRun({ invoiceNumber: null, amountCents: 5000 })],
        },
        isLoading: false,
        error: null,
      } as any);

      const { result } = renderHook(() => useSequenceDetailViewModel("seq-1"), { wrapper });

      expect(result.current.runRows[0].invoiceNumber).toBe("—");
    });

    it("formats 0 cents as $0.00", () => {
      mockUseSequence.mockReturnValue({
        data: makeSequence({}),
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
      mockUseSequenceRuns.mockReturnValue({
        data: { data: [makeRun({ amountCents: 0 })] },
        isLoading: false,
        error: null,
      } as any);

      const { result } = renderHook(() => useSequenceDetailViewModel("seq-1"), { wrapper });

      expect(result.current.runRows[0].amountText).toBe("$0.00");
    });

    it("returns empty runRows when runs are undefined", () => {
      mockUseSequence.mockReturnValue({
        data: makeSequence({}),
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
      mockUseSequenceRuns.mockReturnValue({ data: undefined, isLoading: false, error: null } as any);

      const { result } = renderHook(() => useSequenceDetailViewModel("seq-1"), { wrapper });

      expect(result.current.runRows).toHaveLength(0);
    });
  });

  describe("canEditSteps", () => {
    it("is true when activeRuns is 0", () => {
      mockUseSequence.mockReturnValue({
        data: makeSequence({ activeRuns: 0 }),
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
      mockUseSequenceRuns.mockReturnValue({ data: undefined, isLoading: false, error: null } as any);

      const { result } = renderHook(() => useSequenceDetailViewModel("seq-1"), { wrapper });

      expect(result.current.canEditSteps).toBe(true);
    });

    it("is false when activeRuns > 0", () => {
      mockUseSequence.mockReturnValue({
        data: makeSequence({ activeRuns: 3 }),
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
      mockUseSequenceRuns.mockReturnValue({ data: undefined, isLoading: false, error: null } as any);

      const { result } = renderHook(() => useSequenceDetailViewModel("seq-1"), { wrapper });

      expect(result.current.canEditSteps).toBe(false);
    });

    it("defaults to true when sequence data is not yet loaded", () => {
      mockUseSequence.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      } as any);
      mockUseSequenceRuns.mockReturnValue({ data: undefined, isLoading: true, error: null } as any);

      const { result } = renderHook(() => useSequenceDetailViewModel("seq-1"), { wrapper });

      expect(result.current.canEditSteps).toBe(true);
    });
  });

  describe("actions", () => {
    beforeEach(() => {
      mockUseSequence.mockReturnValue({
        data: makeSequence({ isActive: true, activeRuns: 0 }),
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
      mockUseSequenceRuns.mockReturnValue({
        data: { data: [makeRun({ id: "run-1", customerId: "cust-1" })] },
        isLoading: false,
        error: null,
      } as any);
    });

    it("pause() calls usePauseSequence mutate with {id, businessId}", async () => {
      mockPauseMutate.mockResolvedValue({});
      const { result } = renderHook(() => useSequenceDetailViewModel("seq-1"), { wrapper });

      await act(async () => {
        await result.current.pause();
      });

      expect(mockPauseMutate).toHaveBeenCalledWith({ id: "seq-1", businessId: "biz-1" });
    });

    it("activate() calls useActivateSequence mutate with {id, businessId}", async () => {
      mockActivateMutate.mockResolvedValue({});
      const { result } = renderHook(() => useSequenceDetailViewModel("seq-1"), { wrapper });

      await act(async () => {
        await result.current.activate();
      });

      expect(mockActivateMutate).toHaveBeenCalledWith({ id: "seq-1", businessId: "biz-1" });
    });

    it("removeInvoice(runId) calls useStopSequenceRun mutate with {id: runId, businessId}", async () => {
      mockStopRunMutate.mockResolvedValue({});
      const { result } = renderHook(() => useSequenceDetailViewModel("seq-1"), { wrapper });

      await act(async () => {
        await result.current.removeInvoice("run-1");
      });

      expect(mockStopRunMutate).toHaveBeenCalledWith({ id: "run-1", businessId: "biz-1" });
    });

    it("removeCustomer(customerId) calls useDetachCustomer mutate with {id, businessId, customerId}", async () => {
      mockDetachMutate.mockResolvedValue({});
      const { result } = renderHook(() => useSequenceDetailViewModel("seq-1"), { wrapper });

      await act(async () => {
        await result.current.removeCustomer("cust-1");
      });

      expect(mockDetachMutate).toHaveBeenCalledWith({ id: "seq-1", businessId: "biz-1", customerId: "cust-1" });
    });

    it("sets error string when pause() throws", async () => {
      mockPauseMutate.mockRejectedValue(new Error("Pause failed"));
      const { result } = renderHook(() => useSequenceDetailViewModel("seq-1"), { wrapper });

      await act(async () => {
        await result.current.pause();
      });

      await waitFor(() => expect(result.current.error).toMatch(/Pause failed/));
    });

    it("sets error string when removeInvoice() throws", async () => {
      mockStopRunMutate.mockRejectedValue(new Error("Stop failed"));
      const { result } = renderHook(() => useSequenceDetailViewModel("seq-1"), { wrapper });

      await act(async () => {
        await result.current.removeInvoice("run-1");
      });

      await waitFor(() => expect(result.current.error).toMatch(/Stop failed/));
    });

    it("sets error string when removeCustomer() throws", async () => {
      mockDetachMutate.mockRejectedValue(new Error("Detach failed"));
      const { result } = renderHook(() => useSequenceDetailViewModel("seq-1"), { wrapper });

      await act(async () => {
        await result.current.removeCustomer("cust-1");
      });

      await waitFor(() => expect(result.current.error).toMatch(/Detach failed/));
    });

    it("clears error before a successful action", async () => {
      mockPauseMutate.mockRejectedValueOnce(new Error("First fail"));
      mockPauseMutate.mockResolvedValue({});
      const { result } = renderHook(() => useSequenceDetailViewModel("seq-1"), { wrapper });

      await act(async () => { await result.current.pause(); });
      await waitFor(() => expect(result.current.error).toBeTruthy());

      await act(async () => { await result.current.pause(); });
      await waitFor(() => expect(result.current.error).toBeNull());
    });
  });

  describe("tab state", () => {
    it("defaults to 'flow' tab", () => {
      mockUseSequence.mockReturnValue({
        data: makeSequence({}),
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
      mockUseSequenceRuns.mockReturnValue({ data: undefined, isLoading: false, error: null } as any);

      const { result } = renderHook(() => useSequenceDetailViewModel("seq-1"), { wrapper });

      expect(result.current.tab).toBe("flow");
    });

    it("setTab changes the active tab", () => {
      mockUseSequence.mockReturnValue({
        data: makeSequence({}),
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
      mockUseSequenceRuns.mockReturnValue({ data: undefined, isLoading: false, error: null } as any);

      const { result } = renderHook(() => useSequenceDetailViewModel("seq-1"), { wrapper });

      act(() => result.current.setTab("audience"));
      expect(result.current.tab).toBe("audience");

      act(() => result.current.setTab("flow"));
      expect(result.current.tab).toBe("flow");
    });
  });

  describe("loading and error passthrough", () => {
    it("exposes isLoading true when sequence is loading", () => {
      mockUseSequence.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      } as any);
      mockUseSequenceRuns.mockReturnValue({ data: undefined, isLoading: false, error: null } as any);

      const { result } = renderHook(() => useSequenceDetailViewModel("seq-1"), { wrapper });

      expect(result.current.isLoading).toBe(true);
    });

    it("exposes name and isActive from sequence data", () => {
      mockUseSequence.mockReturnValue({
        data: makeSequence({ name: "My Sequence", isActive: false }),
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
      mockUseSequenceRuns.mockReturnValue({ data: undefined, isLoading: false, error: null } as any);

      const { result } = renderHook(() => useSequenceDetailViewModel("seq-1"), { wrapper });

      expect(result.current.name).toBe("My Sequence");
      expect(result.current.isActive).toBe(false);
    });
  });
});
