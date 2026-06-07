import { renderHook, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { useOnboardingViewModel } from "./onboarding.view-model";

// --- Mock query hooks ---
const createBusinessMutateAsync = vi.fn();
const authorizeConnectionMutateAsync = vi.fn();

vi.mock("../../queries/use-businesses", () => ({
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
});
