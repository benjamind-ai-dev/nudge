import { renderHook, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useOnboardingBillingViewModel } from "./onboarding-billing.view-model";

const mutateAsync = vi.fn();
vi.mock("../../queries/use-billing", () => ({
  useCreateCheckout: () => ({ mutateAsync, isPending: false }),
}));

const wrapper =
  (initialEntries: string[]) =>
  ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  );

describe("useOnboardingBillingViewModel", () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    // jsdom: make location assignable
    Object.defineProperty(window, "location", {
      writable: true,
      value: { href: "" },
    });
  });

  it("exposes the three plans with Growth featured", () => {
    const { result } = renderHook(() => useOnboardingBillingViewModel(), {
      wrapper: wrapper(["/onboarding/billing"]),
    });
    expect(result.current.plans.map((p) => p.plan)).toEqual([
      "starter",
      "growth",
      "agency",
    ]);
    expect(result.current.plans.find((p) => p.featured)?.plan).toBe("growth");
  });

  it("reads ?plan= preselection and ?cancelled= banner from the URL", () => {
    const { result } = renderHook(() => useOnboardingBillingViewModel(), {
      wrapper: wrapper(["/onboarding/billing?plan=agency&cancelled=true"]),
    });
    expect(result.current.preselectedPlan).toBe("agency");
    expect(result.current.showCancelledBanner).toBe(true);
  });

  it("redirects to the Stripe checkout url on choose", async () => {
    mutateAsync.mockResolvedValue({ checkout_url: "https://checkout.stripe/x" });
    const { result } = renderHook(() => useOnboardingBillingViewModel(), {
      wrapper: wrapper(["/onboarding/billing"]),
    });

    await act(async () => {
      await result.current.handleChoose("growth");
    });

    expect(mutateAsync).toHaveBeenCalledWith("growth");
    expect(window.location.href).toBe("https://checkout.stripe/x");
  });

  it("surfaces an error when checkout fails", async () => {
    mutateAsync.mockRejectedValue(new Error("Stripe down"));
    const { result } = renderHook(() => useOnboardingBillingViewModel(), {
      wrapper: wrapper(["/onboarding/billing"]),
    });

    await act(async () => {
      await result.current.handleChoose("starter");
    });

    await waitFor(() => expect(result.current.error).toBe("Stripe down"));
    expect(result.current.pendingPlan).toBeNull();
  });
});
