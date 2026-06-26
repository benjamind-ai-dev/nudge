import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useStepDraft, draftStepFromDetail, newStep } from "./use-step-draft";
import type { DraftStep } from "./use-step-draft";

const tmpl = (id: string, name: string, subject = `${name} subj`, body = `${name} body`) => ({
  id,
  businessId: "biz-1",
  name,
  subject,
  body,
  signature: null,
  createdAt: "",
  updatedAt: "",
  inUse: false,
});

const mockTemplates = vi.fn();
vi.mock("@/queries/use-templates", () => ({
  useTemplates: () => mockTemplates(),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

beforeEach(() => {
  mockTemplates.mockReturnValue({
    data: { data: [tmpl("t1", "Reminder"), tmpl("t2", "Past due")] },
    isLoading: false,
  });
});

describe("useStepDraft", () => {
  it("seeds a single step by default", () => {
    const { result } = renderHook(() => useStepDraft("biz-1"), { wrapper });
    expect(result.current.steps).toHaveLength(1);
    expect(result.current.steps[0].templateId).toBeNull();
    expect(result.current.activeStepKey).toBe(result.current.steps[0].key);
  });

  it("seeds from initialSteps when provided", () => {
    const initial: DraftStep[] = [
      { key: "custom-1", templateId: "t1", templateName: "Reminder", channel: "email", delayDays: 3, isOwnerAlert: false, includePaymentLink: true },
    ];
    const { result } = renderHook(() => useStepDraft("biz-1", { initialSteps: initial }), { wrapper });
    expect(result.current.steps).toHaveLength(1);
    expect(result.current.steps[0].templateId).toBe("t1");
    expect(result.current.activeStepKey).toBe("custom-1");
  });

  it("addStep appends and sets as active", () => {
    const { result } = renderHook(() => useStepDraft("biz-1"), { wrapper });
    act(() => result.current.addStep());
    expect(result.current.steps).toHaveLength(2);
    expect(result.current.activeStepKey).toBe(result.current.steps[1].key);
  });

  it("removeStep removes by key and clears activeStepKey if it was active", () => {
    const { result } = renderHook(() => useStepDraft("biz-1"), { wrapper });
    const k0 = result.current.steps[0].key;
    act(() => result.current.addStep());
    // k0 is no longer active; remove it
    act(() => result.current.removeStep(k0));
    expect(result.current.steps).toHaveLength(1);
    expect(result.current.steps[0].key).not.toBe(k0);
  });

  it("removeStep on the active step clears activeStepKey", () => {
    const { result } = renderHook(() => useStepDraft("biz-1"), { wrapper });
    const k = result.current.steps[0].key;
    act(() => result.current.removeStep(k));
    expect(result.current.activeStepKey).toBeNull();
  });

  it("moveStep reorders steps", () => {
    const { result } = renderHook(() => useStepDraft("biz-1"), { wrapper });
    act(() => result.current.addStep());
    const k0 = result.current.steps[0].key;
    const k1 = result.current.steps[1].key;
    act(() => result.current.moveStep(k1, "up"));
    expect(result.current.steps[0].key).toBe(k1);
    expect(result.current.steps[1].key).toBe(k0);
  });

  it("setStepTemplate sets templateId and templateName from loaded templates", () => {
    const { result } = renderHook(() => useStepDraft("biz-1"), { wrapper });
    const k = result.current.steps[0].key;
    act(() => result.current.setStepTemplate(k, "t2"));
    expect(result.current.steps[0]).toMatchObject({ templateId: "t2", templateName: "Past due" });
  });

  it("computes cumulative displayDay for rows (delays [0,3,4] → [0,3,7])", () => {
    const { result } = renderHook(() => useStepDraft("biz-1"), { wrapper });
    const k0 = result.current.steps[0].key;
    act(() => result.current.setStepDelay(k0, 0));
    act(() => result.current.setStepTemplate(k0, "t1"));
    act(() => result.current.addStep());
    const k1 = result.current.steps[1].key;
    act(() => result.current.setStepDelay(k1, 3));
    act(() => result.current.addStep());
    const k2 = result.current.steps[2].key;
    act(() => result.current.setStepDelay(k2, 4));
    expect(result.current.rows.map((r) => r.displayDay)).toEqual([0, 3, 7]);
  });

  it("allStepsComplete is false when any step has no templateId", () => {
    const { result } = renderHook(() => useStepDraft("biz-1"), { wrapper });
    expect(result.current.allStepsComplete).toBe(false);
  });

  it("allStepsComplete is true when all steps have a templateId", () => {
    const { result } = renderHook(() => useStepDraft("biz-1"), { wrapper });
    act(() => result.current.setStepTemplate(result.current.steps[0].key, "t1"));
    expect(result.current.allStepsComplete).toBe(true);
  });

  it("allStepsComplete is false when steps is empty", () => {
    const { result } = renderHook(() => useStepDraft("biz-1"), { wrapper });
    act(() => result.current.removeStep(result.current.steps[0].key));
    expect(result.current.allStepsComplete).toBe(false);
  });

  it("buildPayload returns correct shape with bridge fields from template", () => {
    const { result } = renderHook(() => useStepDraft("biz-1"), { wrapper });
    const k = result.current.steps[0].key;
    act(() => result.current.setStepTemplate(k, "t1"));
    act(() => result.current.setStepDelay(k, 2));
    const payload = result.current.buildPayload();
    expect(payload).toHaveLength(1);
    expect(payload[0]).toMatchObject({
      templateId: "t1",
      stepOrder: 1,
      delayDays: 2,
      channel: "email",
      subjectTemplate: "Reminder subj",
      bodyTemplate: "Reminder body",
      smsBodyTemplate: null,
      isOwnerAlert: false,
      includePaymentLink: true,
    });
  });

  it("buildPayload sets stepOrder correctly for multiple steps", () => {
    const { result } = renderHook(() => useStepDraft("biz-1"), { wrapper });
    act(() => result.current.setStepTemplate(result.current.steps[0].key, "t1"));
    act(() => result.current.addStep());
    act(() => result.current.setStepTemplate(result.current.steps[1].key, "t2"));
    const payload = result.current.buildPayload();
    expect(payload[0].stepOrder).toBe(1);
    expect(payload[1].stepOrder).toBe(2);
  });

  it("doneStep collapses active complete step; editStep re-expands", () => {
    const { result } = renderHook(() => useStepDraft("biz-1"), { wrapper });
    const k = result.current.steps[0].key;
    act(() => result.current.setStepTemplate(k, "t1"));
    act(() => result.current.doneStep());
    expect(result.current.activeStepKey).toBeNull();
    act(() => result.current.editStep(k));
    expect(result.current.activeStepKey).toBe(k);
  });

  it("isStepComplete returns true only when templateId is set", () => {
    const { result } = renderHook(() => useStepDraft("biz-1"), { wrapper });
    const step = result.current.steps[0];
    expect(result.current.isStepComplete(step)).toBe(false);
    act(() => result.current.setStepTemplate(step.key, "t1"));
    expect(result.current.isStepComplete(result.current.steps[0])).toBe(true);
  });

  it("toggleOwnerAlert flips isOwnerAlert", () => {
    const { result } = renderHook(() => useStepDraft("biz-1"), { wrapper });
    const k = result.current.steps[0].key;
    expect(result.current.steps[0].isOwnerAlert).toBe(false);
    act(() => result.current.toggleOwnerAlert(k));
    expect(result.current.steps[0].isOwnerAlert).toBe(true);
  });

  it("togglePaymentLink flips includePaymentLink", () => {
    const { result } = renderHook(() => useStepDraft("biz-1"), { wrapper });
    const k = result.current.steps[0].key;
    expect(result.current.steps[0].includePaymentLink).toBe(true);
    act(() => result.current.togglePaymentLink(k));
    expect(result.current.steps[0].includePaymentLink).toBe(false);
  });

  it("hasNoTemplates true when template list is empty", () => {
    mockTemplates.mockReturnValue({ data: { data: [] }, isLoading: false });
    const { result } = renderHook(() => useStepDraft("biz-1"), { wrapper });
    expect(result.current.hasNoTemplates).toBe(true);
  });

  it("setStepDelay clamps negative to 0", () => {
    const { result } = renderHook(() => useStepDraft("biz-1"), { wrapper });
    const k = result.current.steps[0].key;
    act(() => result.current.setStepDelay(k, -5));
    expect(result.current.steps[0].delayDays).toBe(0);
  });
});

describe("draftStepFromDetail", () => {
  it("maps templateId, templateName, channel, delayDays, toggles; generates a new key", () => {
    const templates = [tmpl("t1", "Reminder")];
    const detail = {
      id: "step-1",
      templateId: "t1",
      stepOrder: 1,
      delayDays: 5,
      channel: "email" as const,
      subjectTemplate: "Reminder subj",
      bodyTemplate: "Reminder body",
      smsBodyTemplate: null,
      isOwnerAlert: true,
      includePaymentLink: false,
      createdAt: "",
      updatedAt: "",
    };
    const draft = draftStepFromDetail(detail, templates);
    expect(draft.templateId).toBe("t1");
    expect(draft.templateName).toBe("Reminder");
    expect(draft.channel).toBe("email");
    expect(draft.delayDays).toBe(5);
    expect(draft.isOwnerAlert).toBe(true);
    expect(draft.includePaymentLink).toBe(false);
    expect(draft.key).toMatch(/^s\d+$/);
  });

  it("uses empty templateName when template not found in list", () => {
    const draft = draftStepFromDetail(
      {
        id: "step-2",
        templateId: "unknown",
        stepOrder: 1,
        delayDays: 0,
        channel: "email" as const,
        subjectTemplate: null,
        bodyTemplate: "",
        smsBodyTemplate: null,
        isOwnerAlert: false,
        includePaymentLink: true,
        createdAt: "",
        updatedAt: "",
      },
      [],
    );
    expect(draft.templateName).toBe("");
    expect(draft.templateId).toBe("unknown");
  });

  it("handles null templateId gracefully", () => {
    const draft = draftStepFromDetail(
      {
        id: "step-3",
        templateId: undefined,
        stepOrder: 1,
        delayDays: 0,
        channel: "sms" as const,
        subjectTemplate: null,
        bodyTemplate: "",
        smsBodyTemplate: null,
        isOwnerAlert: false,
        includePaymentLink: false,
        createdAt: "",
        updatedAt: "",
      },
      [tmpl("t1", "Reminder")],
    );
    expect(draft.templateId).toBeNull();
    expect(draft.templateName).toBe("");
  });
});

describe("newStep", () => {
  it("returns a step with default values and a unique key", () => {
    const a = newStep();
    const b = newStep();
    expect(a.key).not.toBe(b.key);
    expect(a.channel).toBe("email");
    expect(a.templateId).toBeNull();
    expect(a.delayDays).toBe(0);
    expect(a.includePaymentLink).toBe(true);
    expect(a.isOwnerAlert).toBe(false);
  });
});
