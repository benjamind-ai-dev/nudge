import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useTemplatesViewModel } from "./templates.view-model";
import type { Template } from "../../api/templates.api";

let mockTemplates: Template[] = [];
const deleteMutateAsync = vi.fn().mockResolvedValue(undefined);
const navigateMock = vi.fn();

vi.mock("../../queries/use-templates", () => ({
  useTemplates: () => ({ data: { data: mockTemplates }, isLoading: false, error: null, refetch: vi.fn() }),
  useDeleteTemplate: () => ({ mutateAsync: deleteMutateAsync, isPending: false }),
}));
vi.mock("../../lib/hooks/use-active-business-id", () => ({
  useActiveBusinessId: () => ({ businessId: "biz-1", isLoading: false, hasMultiple: false }),
}));
vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return { ...actual, useNavigate: () => navigateMock };
});

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}
function makeTemplate(over: Partial<Template> = {}): Template {
  return { id: "t-1", businessId: "biz-1", name: "Friendly reminder", subject: "Invoice {{invoice_number}}", body: "Hi", signature: null, createdAt: "", updatedAt: "2026-06-24T00:00:00.000Z", ...over };
}

describe("useTemplatesViewModel", () => {
  it("maps templates to rows with a subject preview", () => {
    mockTemplates = [makeTemplate()];
    const { result } = renderHook(() => useTemplatesViewModel(), { wrapper });
    expect(result.current.rows[0].name).toBe("Friendly reminder");
    expect(result.current.rows[0].subjectPreview).toBe("Invoice {{invoice_number}}");
  });

  it("falls back to a placeholder subject preview when subject is null", () => {
    mockTemplates = [makeTemplate({ subject: null })];
    const { result } = renderHook(() => useTemplatesViewModel(), { wrapper });
    expect(result.current.rows[0].subjectPreview).toBe("No subject");
  });

  it("opens and confirms delete", async () => {
    mockTemplates = [makeTemplate()];
    const { result } = renderHook(() => useTemplatesViewModel(), { wrapper });
    act(() => { result.current.openDelete({ id: "t-1", name: "Friendly reminder" }); });
    expect(result.current.deleteTarget?.id).toBe("t-1");
    await act(async () => { await result.current.confirmDelete(); });
    expect(deleteMutateAsync).toHaveBeenCalledWith({ id: "t-1", businessId: "biz-1" });
    expect(result.current.deleteTarget).toBeNull();
  });

});
