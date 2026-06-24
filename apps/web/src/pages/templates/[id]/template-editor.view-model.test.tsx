import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { resolveVariables, SAMPLE_DATA, useTemplateEditorViewModel } from "./template-editor.view-model";

const navigateMock = vi.fn();
const createMutateAsync = vi.fn().mockResolvedValue({ data: { id: "t-new" } });
const updateMutateAsync = vi.fn().mockResolvedValue({ data: { id: "t-1" } });
const generateMutateAsync = vi.fn();
let mockTemplate: unknown = undefined;

vi.mock("@/queries/use-templates", () => ({
  useTemplate: () => ({ data: mockTemplate, isLoading: false }),
  useCreateTemplate: () => ({ mutateAsync: createMutateAsync, isPending: false }),
  useUpdateTemplate: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
  useGenerateTemplate: () => ({ mutateAsync: generateMutateAsync, isPending: false }),
}));

vi.mock("@/lib/hooks/use-active-business-id", () => ({
  useActiveBusinessId: () => ({ businessId: "biz-1", senderName: "Sarah Chen", isLoading: false, hasMultiple: false }),
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return { ...actual, useNavigate: () => navigateMock };
});

describe("resolveVariables", () => {
  it("replaces known tokens with sample values", () => {
    expect(resolveVariables("Hi {{contact_name}}")).toBe(`Hi ${SAMPLE_DATA.contact_name}`);
  });

  it("tolerates internal whitespace in tokens", () => {
    expect(resolveVariables("Inv {{ invoice_number }}")).toBe(`Inv ${SAMPLE_DATA.invoice_number}`);
  });

  it("leaves unknown tokens literal so authors see typos", () => {
    expect(resolveVariables("Hi {{frist_name}}")).toBe("Hi {{frist_name}}");
  });
});

describe("useTemplateEditorViewModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish default resolved values cleared by clearAllMocks
    createMutateAsync.mockResolvedValue({ data: { id: "t-new" } });
    updateMutateAsync.mockResolvedValue({ data: { id: "t-1" } });
  });

  it("treats undefined id as new template (empty fields, not saveable)", () => {
    mockTemplate = undefined;
    const { result } = renderHook(() => useTemplateEditorViewModel(undefined));
    expect(result.current.isNew).toBe(true);
    expect(result.current.name).toBe("");
    expect(result.current.canSave).toBe(false); // needs name + body
  });

  it("becomes saveable once name and body are set, and creates", async () => {
    mockTemplate = undefined;
    const { result } = renderHook(() => useTemplateEditorViewModel(undefined));
    act(() => { result.current.setName("Friendly reminder"); });
    act(() => { result.current.setBody("Hi {{contact_name}}"); });
    expect(result.current.canSave).toBe(true);
    await act(async () => { await result.current.handleSave(); });
    expect(createMutateAsync).toHaveBeenCalledWith({
      businessId: "biz-1",
      name: "Friendly reminder",
      subject: null,
      body: "Hi {{contact_name}}",
      signature: null,
    });
    expect(navigateMock).toHaveBeenCalledWith("/templates");
  });

  it("hydrates fields from a loaded template and updates", async () => {
    mockTemplate = { data: { id: "t-1", businessId: "biz-1", name: "Second notice", subject: "Overdue", body: "Body {{amount}}", signature: "Sig", createdAt: "", updatedAt: "" } };
    const { result } = renderHook(() => useTemplateEditorViewModel("t-1"));
    await waitFor(() => expect(result.current.name).toBe("Second notice"));
    await act(async () => { await result.current.handleSave(); });
    expect(updateMutateAsync).toHaveBeenCalledWith({
      id: "t-1",
      input: { businessId: "biz-1", name: "Second notice", subject: "Overdue", body: "Body {{amount}}", signature: "Sig" },
    });
  });

  it("AI generate fills the form fields", async () => {
    mockTemplate = undefined;
    generateMutateAsync.mockResolvedValueOnce({ data: { name: "Reminder", subject: "Sub", body: "Body", signature: "Sig" } });
    const { result } = renderHook(() => useTemplateEditorViewModel(undefined));
    act(() => { result.current.setAiDescription("a polite reminder"); });
    await act(async () => { await result.current.handleGenerate(); });
    expect(result.current.name).toBe("Reminder");
    expect(result.current.subject).toBe("Sub");
    expect(result.current.body).toBe("Body");
  });

  it("preview strips the payment_link token and flags hasPaymentLink", async () => {
    mockTemplate = undefined;
    const { result } = renderHook(() => useTemplateEditorViewModel(undefined));
    act(() => { result.current.setBody("Pay here {{payment_link}}"); });
    expect(result.current.preview.hasPaymentLink).toBe(true);
    expect(result.current.preview.bodyHtml).not.toContain("{{payment_link}}");
  });
});
