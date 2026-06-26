import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useSequenceEditorViewModel } from "./sequence-editor.view-model";

const navigate = vi.fn();
vi.mock("react-router", async (orig) => ({ ...(await orig() as object), useNavigate: () => navigate }));
vi.mock("@/lib/hooks/use-active-business-id", () => ({
  useActiveBusinessId: () => ({ businessId: "biz-1", isLoading: false, hasMultiple: false }),
}));
const mockCreate = vi.fn();
const mockAttach = vi.fn();
const mockEnroll = vi.fn();
vi.mock("@/queries/use-sequences", () => ({
  useCreateSequence: () => ({ mutateAsync: mockCreate, isPending: false }),
  useAttachCustomer: () => ({ mutateAsync: mockAttach, isPending: false }),
  useEnrollInvoices: () => ({ mutateAsync: mockEnroll, isPending: false }),
}));
const tmpl = (id: string, name: string) => ({ id, businessId: "biz-1", name, subject: `${name} subj`, body: `${name} body`, signature: null, createdAt: "", updatedAt: "", inUse: false });
const mockTemplates = vi.fn();
vi.mock("@/queries/use-templates", () => ({ useTemplates: () => mockTemplates() }));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
);
beforeEach(() => {
  navigate.mockReset();
  mockCreate.mockReset();
  mockAttach.mockReset();
  mockEnroll.mockReset();
  mockTemplates.mockReturnValue({ data: { data: [tmpl("t1","Reminder"), tmpl("t2","Past due")] }, isLoading: false });
});

describe("useSequenceEditorViewModel", () => {
  it("starts empty and cannot save without a name and a step", () => {
    const { result } = renderHook(useSequenceEditorViewModel, { wrapper });
    expect(result.current.steps).toHaveLength(1);
    expect(result.current.steps[0].templateId).toBeNull();
    expect(result.current.canSave).toBe(false);
  });

  it("add/remove/move steps", () => {
    const { result } = renderHook(useSequenceEditorViewModel, { wrapper });
    act(() => result.current.addStep());
    expect(result.current.steps).toHaveLength(2);
    const k0 = result.current.steps[0].key;
    act(() => result.current.removeStep(k0));
    expect(result.current.steps).toHaveLength(1);
  });

  it("picking a template sets templateId + display name", () => {
    const { result } = renderHook(useSequenceEditorViewModel, { wrapper });
    const k = result.current.steps[0].key;
    act(() => result.current.setStepTemplate(k, "t2"));
    expect(result.current.steps[0]).toMatchObject({ templateId: "t2", templateName: "Past due" });
  });

  it("canSave true once name + a step with a template exist", () => {
    const { result } = renderHook(useSequenceEditorViewModel, { wrapper });
    act(() => result.current.setName("Standard"));
    expect(result.current.canSave).toBe(false); // seeded step has no template yet
    act(() => result.current.setStepTemplate(result.current.steps[0].key, "t1"));
    expect(result.current.canSave).toBe(true);
  });

  it("save() builds steps payload (stepOrder, body/subject from template) and navigates to /sequences", async () => {
    mockCreate.mockResolvedValue({ data: { id: "seq-1" } });
    const { result } = renderHook(useSequenceEditorViewModel, { wrapper });
    act(() => result.current.setName("Standard"));
    act(() => result.current.setStepTemplate(result.current.steps[0].key, "t1"));
    await act(async () => { await result.current.save(); });
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      businessId: "biz-1", name: "Standard",
      steps: [expect.objectContaining({ stepOrder: 1, templateId: "t1", bodyTemplate: "Reminder body", subjectTemplate: "Reminder subj", channel: "email", delayDays: 0, smsBodyTemplate: null })],
    }));
    expect(navigate).toHaveBeenCalledWith("/sequences");
  });

  it("surfaces a save error (e.g. SMS not on plan)", async () => {
    mockCreate.mockRejectedValue(new Error("SMS reminders aren't included in your plan. Upgrade to use SMS."));
    const { result } = renderHook(useSequenceEditorViewModel, { wrapper });
    act(() => result.current.setName("X"));
    act(() => result.current.setStepTemplate(result.current.steps[0].key, "t1"));
    await act(async () => { await result.current.save(); });
    await waitFor(() => expect(result.current.error).toMatch(/SMS/i));
  });

  it("hasNoTemplates true when the template list is empty", () => {
    mockTemplates.mockReturnValue({ data: { data: [] }, isLoading: false });
    const { result } = renderHook(useSequenceEditorViewModel, { wrapper });
    expect(result.current.hasNoTemplates).toBe(true);
  });

  it("seeded step is active; adding a step makes the new one active", () => {
    const { result } = renderHook(useSequenceEditorViewModel, { wrapper });
    const first = result.current.rows[0];
    expect(first.isActive).toBe(true);
    expect(first.index).toBe(0);
    act(() => result.current.addStep());
    const rows = result.current.rows;
    expect(rows).toHaveLength(2);
    expect(rows[1].isActive).toBe(true);   // new step active
    expect(rows[0].isActive).toBe(false);  // first collapsed
  });

  it("computes cumulative display day from delays", () => {
    const { result } = renderHook(useSequenceEditorViewModel, { wrapper });
    act(() => result.current.setStepTemplate(result.current.rows[0].step.key, "t1"));
    act(() => result.current.setStepDelay(result.current.rows[0].step.key, 0));
    act(() => result.current.addStep());
    act(() => result.current.setStepDelay(result.current.rows[1].step.key, 3));
    act(() => result.current.addStep());
    act(() => result.current.setStepDelay(result.current.rows[2].step.key, 4));
    expect(result.current.rows.map((r) => r.displayDay)).toEqual([0, 3, 7]);
  });

  it("doneStep collapses the active complete step; editStep re-expands", () => {
    const { result } = renderHook(useSequenceEditorViewModel, { wrapper });
    const k = result.current.rows[0].step.key;
    act(() => result.current.setStepTemplate(k, "t1"));
    act(() => result.current.doneStep());
    expect(result.current.rows[0].isActive).toBe(false);
    act(() => result.current.editStep(k));
    expect(result.current.rows[0].isActive).toBe(true);
  });

  it("isComplete reflects whether a template is chosen", () => {
    const { result } = renderHook(useSequenceEditorViewModel, { wrapper });
    expect(result.current.rows[0].isComplete).toBe(false);
    act(() => result.current.setStepTemplate(result.current.rows[0].step.key, "t1"));
    expect(result.current.rows[0].isComplete).toBe(true);
  });

  // ---- audience attach/enroll tests ----

  it("save with NO audience → only createMut called, navigate('/sequences')", async () => {
    mockCreate.mockResolvedValue({ data: { id: "seq-1" } });
    const { result } = renderHook(useSequenceEditorViewModel, { wrapper });
    act(() => result.current.setName("Standard"));
    act(() => result.current.setStepTemplate(result.current.steps[0].key, "t1"));
    await act(async () => { await result.current.save(); });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockAttach).not.toHaveBeenCalled();
    expect(mockEnroll).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/sequences");
  });

  it("save with customer-mode audience (2 ids) → create then attachMut×2 with seqId+each id, then navigate", async () => {
    mockCreate.mockResolvedValue({ data: { id: "seq-2" } });
    mockAttach.mockResolvedValue({});
    const { result } = renderHook(useSequenceEditorViewModel, { wrapper });
    act(() => result.current.setName("Standard"));
    act(() => result.current.setStepTemplate(result.current.steps[0].key, "t1"));
    act(() => result.current.setAudience({ mode: "customer", customerIds: ["cust-1", "cust-2"] }));
    await act(async () => { await result.current.save(); });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockAttach).toHaveBeenCalledTimes(2);
    expect(mockAttach).toHaveBeenCalledWith({ sequenceId: "seq-2", businessId: "biz-1", customerId: "cust-1" });
    expect(mockAttach).toHaveBeenCalledWith({ sequenceId: "seq-2", businessId: "biz-1", customerId: "cust-2" });
    expect(mockEnroll).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/sequences");
  });

  it("save with invoices-mode audience → create then enrollMut with invoiceIds + seqId, then navigate", async () => {
    mockCreate.mockResolvedValue({ data: { id: "seq-3" } });
    mockEnroll.mockResolvedValue({});
    const { result } = renderHook(useSequenceEditorViewModel, { wrapper });
    act(() => result.current.setName("Standard"));
    act(() => result.current.setStepTemplate(result.current.steps[0].key, "t1"));
    act(() => result.current.setAudience({ mode: "invoices", invoiceIds: ["inv-1", "inv-2"] }));
    await act(async () => { await result.current.save(); });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockEnroll).toHaveBeenCalledTimes(1);
    expect(mockEnroll).toHaveBeenCalledWith({ sequenceId: "seq-3", businessId: "biz-1", invoiceIds: ["inv-1", "inv-2"] });
    expect(mockAttach).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/sequences");
  });

  it("create-ok-but-attach-throws → error mentions 'attaching', createdSequenceId set, NOT navigated; second save() does NOT call create again", async () => {
    mockCreate.mockResolvedValue({ data: { id: "seq-4" } });
    mockAttach.mockRejectedValue(new Error("attach failed"));
    const { result } = renderHook(useSequenceEditorViewModel, { wrapper });
    act(() => result.current.setName("Standard"));
    act(() => result.current.setStepTemplate(result.current.steps[0].key, "t1"));
    act(() => result.current.setAudience({ mode: "customer", customerIds: ["cust-1"] }));

    // First save: create succeeds, attach fails
    await act(async () => { await result.current.save(); });
    await waitFor(() => expect(result.current.error).toMatch(/attaching/i));
    expect(result.current.createdSequenceId).toBe("seq-4");
    expect(navigate).not.toHaveBeenCalled();

    // Second save: should NOT call create again, only retries attach
    mockCreate.mockClear();
    mockAttach.mockResolvedValue({});
    await act(async () => { await result.current.save(); });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/sequences");
  });
});
