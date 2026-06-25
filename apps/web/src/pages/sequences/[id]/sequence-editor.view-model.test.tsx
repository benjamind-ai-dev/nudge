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
vi.mock("@/queries/use-sequences", () => ({ useCreateSequence: () => ({ mutateAsync: mockCreate, isPending: false }) }));
const tmpl = (id: string, name: string) => ({ id, businessId: "biz-1", name, subject: `${name} subj`, body: `${name} body`, signature: null, createdAt: "", updatedAt: "", inUse: false });
const mockTemplates = vi.fn();
vi.mock("@/queries/use-templates", () => ({ useTemplates: () => mockTemplates() }));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
);
beforeEach(() => { navigate.mockReset(); mockCreate.mockReset(); mockTemplates.mockReturnValue({ data: { data: [tmpl("t1","Reminder"), tmpl("t2","Past due")] }, isLoading: false }); });

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
      steps: [expect.objectContaining({ stepOrder: 1, templateId: "t1", bodyTemplate: "Reminder body", subjectTemplate: "Reminder subj", channel: "email", delayDays: 0 })],
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
});
