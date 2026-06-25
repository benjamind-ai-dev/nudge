import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useSequencesViewModel } from "./sequences.view-model";

vi.mock("@/lib/hooks/use-active-business-id", () => ({
  useActiveBusinessId: () => ({ businessId: "biz-1", isLoading: false, hasMultiple: false }),
}));
const mockUseSequences = vi.fn();
const mockDelete = vi.fn();
vi.mock("@/queries/use-sequences", () => ({
  useSequences: (id: string) => mockUseSequences(id),
  useDeleteSequence: () => ({ mutateAsync: mockDelete, isPending: false }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
);
const seq = (o: Partial<any> = {}) => ({
  id: "s1", businessId: "biz-1", name: "Standard reminders", isActive: true,
  stepCount: 4, activeRuns: 12, relationshipTier: { id: "t1", name: "Default" },
  createdAt: "", updatedAt: "", ...o,
});

beforeEach(() => { mockUseSequences.mockReset(); mockDelete.mockReset(); });

describe("useSequencesViewModel", () => {
  it("maps summaries to rows (tier name, step label, status)", () => {
    mockUseSequences.mockReturnValue({ data: { data: [seq()] }, isLoading: false, error: null });
    const { result } = renderHook(useSequencesViewModel, { wrapper });
    expect(result.current.rows[0]).toMatchObject({
      name: "Standard reminders", tierName: "Default", stepCountLabel: "4 steps",
      statusLabel: "Active", activeRuns: 12,
    });
  });

  it("falls back to '—' and singular step label", () => {
    mockUseSequences.mockReturnValue({ data: { data: [seq({ stepCount: 1, relationshipTier: null, isActive: false })] }, isLoading: false, error: null });
    const { result } = renderHook(useSequencesViewModel, { wrapper });
    expect(result.current.rows[0]).toMatchObject({ tierName: "—", stepCountLabel: "1 step", statusLabel: "Paused" });
  });

  it("filters by name (case-insensitive) and by status", () => {
    mockUseSequences.mockReturnValue({ data: { data: [seq({ id: "a", name: "Aggressive", isActive: false }), seq({ id: "b", name: "Gentle", isActive: true })] }, isLoading: false, error: null });
    const { result } = renderHook(useSequencesViewModel, { wrapper });
    act(() => result.current.setSearch("gen"));
    expect(result.current.rows.map(r => r.id)).toEqual(["b"]);
    act(() => { result.current.setSearch(""); result.current.setStatusFilter("paused"); });
    expect(result.current.rows.map(r => r.id)).toEqual(["a"]);
  });

  it("surfaces a friendly 409 message on delete-in-use", async () => {
    mockUseSequences.mockReturnValue({ data: { data: [seq()] }, isLoading: false, error: null });
    mockDelete.mockRejectedValue(new Error("Sequence s1 is assigned to a tier or customer and cannot be deleted"));
    const { result } = renderHook(useSequencesViewModel, { wrapper });
    act(() => result.current.requestDelete(result.current.rows[0]));
    await act(async () => { await result.current.confirmDelete(); });
    await waitFor(() => expect(result.current.deleteError).toMatch(/in use|cannot be deleted|tier or customer/i));
  });

  it("exposes loading and error passthrough", () => {
    mockUseSequences.mockReturnValue({ data: undefined, isLoading: false, error: new Error("boom") });
    const { result } = renderHook(useSequencesViewModel, { wrapper });
    expect(result.current.error).toBe("boom");
  });
});
