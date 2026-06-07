import { renderHook, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { useOnboardingViewModel } from "./onboarding.view-model";

// --- Mock query hooks ---
const createBusinessMutateAsync = vi.fn();
const authorizeConnectionMutateAsync = vi.fn();
let mockBusinessesData: import("../../queries/use-businesses").BusinessWithConnections[] = [];

vi.mock("../../queries/use-businesses", () => ({
  useBusinesses: () => ({
    data: mockBusinessesData,
    isLoading: false,
  }),
  useCreateBusiness: () => ({
    mutateAsync: createBusinessMutateAsync,
    isPending: false,
  }),
}));

vi.mock("../../queries/use-connections", () => ({
  useAuthorizeConnection: () => ({
    mutateAsync: authorizeConnectionMutateAsync,
    isPending: false,
  }),
}));

// --- Mock Clerk ---
const mockEmail = "user@example.com";

vi.mock("@clerk/clerk-react", () => ({
  useUser: () => ({
    user: {
      primaryEmailAddress: { emailAddress: mockEmail },
    },
  }),
}));

// --- Wrapper ---
function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter initialEntries={["/onboarding"]}>{children}</MemoryRouter>;
}

describe("useOnboardingViewModel", () => {
  beforeEach(() => {
    createBusinessMutateAsync.mockReset();
    authorizeConnectionMutateAsync.mockReset();
    mockBusinessesData = [];
    Object.defineProperty(window, "location", {
      writable: true,
      value: { href: "" },
    });
  });

  // --- Prefill ---
  it("prefills senderEmail from Clerk primary email address", () => {
    const { result } = renderHook(() => useOnboardingViewModel(), { wrapper });
    expect(result.current.senderEmail).toBe(mockEmail);
  });

  it("returns a non-empty timezones list", () => {
    const { result } = renderHook(() => useOnboardingViewModel(), { wrapper });
    expect(result.current.timezones.length).toBeGreaterThan(0);
    expect(result.current.timezones[0]).toHaveProperty("value");
    expect(result.current.timezones[0]).toHaveProperty("label");
  });

  // --- Validation ---
  it("invalid email blocks submit and sets per-field error", async () => {
    const { result } = renderHook(() => useOnboardingViewModel(), { wrapper });

    act(() => {
      result.current.setBusinessName("Acme Co");
      result.current.setSenderName("Alice");
      result.current.setSenderEmail("not-an-email");
      result.current.setProvider("quickbooks");
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.errors.senderEmail).toMatch(/valid email/i);
    expect(createBusinessMutateAsync).not.toHaveBeenCalled();
  });

  it("empty required fields set errors on submit", async () => {
    const { result } = renderHook(() => useOnboardingViewModel(), { wrapper });

    // Clear everything (defaults have senderEmail prefilled)
    act(() => {
      result.current.setBusinessName("");
      result.current.setSenderName("");
      result.current.setSenderEmail("");
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.errors.businessName).toMatch(/enter your business name/i);
    expect(result.current.errors.senderName).toMatch(/enter a sender name/i);
    expect(result.current.errors.senderEmail).toMatch(/valid email/i);
    expect(result.current.errors.timezone).toBeUndefined(); // timezone has a default
    expect(createBusinessMutateAsync).not.toHaveBeenCalled();
  });

  it("missing provider blocks submit", async () => {
    const { result } = renderHook(() => useOnboardingViewModel(), { wrapper });

    act(() => {
      result.current.setBusinessName("Acme Co");
      result.current.setSenderName("Alice");
      result.current.setSenderEmail("alice@acme.com");
    });
    // provider not set

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.errors.provider).toBeDefined();
    expect(createBusinessMutateAsync).not.toHaveBeenCalled();
  });

  // --- Happy path ---
  it("valid form + provider calls createBusiness then authorizeConnection then sets window.location.href", async () => {
    createBusinessMutateAsync.mockResolvedValue({ id: "biz-123" });
    authorizeConnectionMutateAsync.mockResolvedValue({ oauthUrl: "https://qbo.example.com/oauth" });

    const { result } = renderHook(() => useOnboardingViewModel(), { wrapper });

    act(() => {
      result.current.setBusinessName("Acme Co");
      result.current.setSenderName("Alice");
      result.current.setSenderEmail("alice@acme.com");
      result.current.setProvider("quickbooks");
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    await waitFor(() => {
      expect(createBusinessMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Acme Co",
          senderName: "Alice",
          senderEmail: "alice@acme.com",
          accountingProvider: "quickbooks",
        }),
      );
      expect(authorizeConnectionMutateAsync).toHaveBeenCalledWith({
        businessId: "biz-123",
        provider: "quickbooks",
      });
      expect(window.location.href).toBe("https://qbo.example.com/oauth");
    });
  });

  // --- Error handling ---
  it("createBusiness failure sets submitError and clears isSubmitting", async () => {
    createBusinessMutateAsync.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useOnboardingViewModel(), { wrapper });

    act(() => {
      result.current.setBusinessName("Acme Co");
      result.current.setSenderName("Alice");
      result.current.setSenderEmail("alice@acme.com");
      result.current.setProvider("quickbooks");
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    await waitFor(() => {
      expect(result.current.submitError).toMatch(/something went wrong/i);
      expect(result.current.isSubmitting).toBe(false);
    });
  });

  // --- isValid ---
  it("isValid is false when no provider selected", () => {
    const { result } = renderHook(() => useOnboardingViewModel(), { wrapper });

    act(() => {
      result.current.setBusinessName("Acme Co");
      result.current.setSenderName("Alice");
      result.current.setSenderEmail("alice@acme.com");
    });

    expect(result.current.isValid).toBe(false);
  });

  it("isValid is true when all fields are valid and provider is set", () => {
    const { result } = renderHook(() => useOnboardingViewModel(), { wrapper });

    act(() => {
      result.current.setBusinessName("Acme Co");
      result.current.setSenderName("Alice");
      result.current.setSenderEmail("alice@acme.com");
      result.current.setProvider("xero");
    });

    expect(result.current.isValid).toBe(true);
  });

  // --- Resume mode ---
  describe("resume mode", () => {
    const resumeBusiness: import("../../queries/use-businesses").BusinessWithConnections = {
      id: "biz-resume",
      name: "Resume Corp",
      accountingProvider: "quickbooks",
      senderName: "Resume Name",
      senderEmail: "resume@example.com",
      timezone: "America/Chicago",
      emailSignature: "Thanks,\nResume Corp",
      isActive: true,
      connections: [], // no connected connection → resume business
    };

    it("isResume is false when no businesses exist", () => {
      mockBusinessesData = [];
      const { result } = renderHook(() => useOnboardingViewModel(), { wrapper });
      expect(result.current.isResume).toBe(false);
    });

    it("isResume is false when business has a connected connection", () => {
      mockBusinessesData = [
        {
          ...resumeBusiness,
          connections: [{ provider: "quickbooks", status: "connected" }],
        },
      ];
      const { result } = renderHook(() => useOnboardingViewModel(), { wrapper });
      expect(result.current.isResume).toBe(false);
    });

    it("isResume is true and fields prefilled when a connection-less business exists", async () => {
      mockBusinessesData = [resumeBusiness];
      const { result } = renderHook(() => useOnboardingViewModel(), { wrapper });

      await waitFor(() => {
        expect(result.current.isResume).toBe(true);
        expect(result.current.businessName).toBe("Resume Corp");
        expect(result.current.senderName).toBe("Resume Name");
        expect(result.current.senderEmail).toBe("resume@example.com");
        expect(result.current.timezone).toBe("America/Chicago");
        expect(result.current.emailSignature).toBe("Thanks,\nResume Corp");
        expect(result.current.provider).toBe("quickbooks");
      });
    });

    it("submitLabel is 'Connect' in resume mode and 'Continue →' otherwise", async () => {
      mockBusinessesData = [resumeBusiness];
      const { result: resumeResult } = renderHook(() => useOnboardingViewModel(), { wrapper });

      await waitFor(() => expect(resumeResult.current.isResume).toBe(true));
      expect(resumeResult.current.submitLabel).toBe("Connect");

      mockBusinessesData = [];
      const { result: freshResult } = renderHook(() => useOnboardingViewModel(), { wrapper });
      expect(freshResult.current.submitLabel).toBe("Continue →");
    });

    it("resume submit skips createBusiness and calls authorizeConnection with existing businessId", async () => {
      mockBusinessesData = [resumeBusiness];
      authorizeConnectionMutateAsync.mockResolvedValue({ oauthUrl: "https://qbo.example.com/resume-oauth" });

      const { result } = renderHook(() => useOnboardingViewModel(), { wrapper });

      await waitFor(() => expect(result.current.isResume).toBe(true));

      await act(async () => {
        await result.current.handleSubmit();
      });

      await waitFor(() => {
        expect(createBusinessMutateAsync).not.toHaveBeenCalled();
        expect(authorizeConnectionMutateAsync).toHaveBeenCalledWith({
          businessId: "biz-resume",
          provider: "quickbooks",
        });
        expect(window.location.href).toBe("https://qbo.example.com/resume-oauth");
      });
    });

    it("non-resume submit still creates a business first", async () => {
      mockBusinessesData = [];
      createBusinessMutateAsync.mockResolvedValue({ id: "biz-new" });
      authorizeConnectionMutateAsync.mockResolvedValue({ oauthUrl: "https://qbo.example.com/new-oauth" });

      const { result } = renderHook(() => useOnboardingViewModel(), { wrapper });
      expect(result.current.isResume).toBe(false);

      act(() => {
        result.current.setBusinessName("New Biz");
        result.current.setSenderName("Bob");
        result.current.setSenderEmail("bob@newbiz.com");
        result.current.setProvider("xero");
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      await waitFor(() => {
        expect(createBusinessMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ name: "New Biz" }),
        );
        expect(authorizeConnectionMutateAsync).toHaveBeenCalledWith({
          businessId: "biz-new",
          provider: "xero",
        });
      });
    });

    it("prefill does not clobber user edits if they already changed a field", async () => {
      mockBusinessesData = [resumeBusiness];
      const { result } = renderHook(() => useOnboardingViewModel(), { wrapper });

      await waitFor(() => expect(result.current.isResume).toBe(true));

      // user edits business name after prefill
      act(() => {
        result.current.setBusinessName("My Custom Name");
      });

      // re-render should not overwrite user's edit (prefilledIdRef guards it)
      expect(result.current.businessName).toBe("My Custom Name");
    });
  });
});
