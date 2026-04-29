import { renderHook, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import type { ReactNode } from "react";
import { useBillingViewModel } from "./billing.view-model";
import type { BillingStatus } from "../../api/billing.api";

vi.mock("../../queries/use-billing", () => ({
  useBillingStatus: vi.fn(),
}));
vi.mock("../../api/billing.api", async (importActual) => ({
  ...(await importActual<typeof import("../../api/billing.api")>()),
  createCheckout: vi.fn(),
  createPortal: vi.fn(),
}));

import { useBillingStatus } from "../../queries/use-billing";
import { createCheckout, createPortal } from "../../api/billing.api";

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

const mockStatus = (overrides: Partial<BillingStatus> = {}): BillingStatus => ({
  plan: null,
  status: "trial",
  current_period_end: null,
  cancel_at_period_end: false,
  trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(),
  has_stripe_customer: false,
  ...overrides,
});

describe("useBillingViewModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useBillingStatus).mockReturnValue({
      data: mockStatus(),
      isLoading: false,
      error: null,
    } as ReturnType<typeof useBillingStatus>);
  });

  it("returns status and loading state", () => {
    const { result } = renderHook(() => useBillingViewModel(), { wrapper });
    expect(result.current.status?.status).toBe("trial");
    expect(result.current.isLoading).toBe(false);
  });

  it("hasActiveSubscription is false on trial", () => {
    const { result } = renderHook(() => useBillingViewModel(), { wrapper });
    expect(result.current.hasActiveSubscription).toBe(false);
  });

  it("hasActiveSubscription is true on active status", () => {
    vi.mocked(useBillingStatus).mockReturnValue({
      data: mockStatus({ status: "active", plan: "starter", has_stripe_customer: true }),
      isLoading: false,
      error: null,
    } as ReturnType<typeof useBillingStatus>);
    const { result } = renderHook(() => useBillingViewModel(), { wrapper });
    expect(result.current.hasActiveSubscription).toBe(true);
  });

  it("handleCheckout redirects to checkout URL", async () => {
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
    });
    vi.mocked(createCheckout).mockResolvedValue({
      data: { checkout_url: "https://checkout.stripe.com/test" },
    });

    const { result } = renderHook(() => useBillingViewModel(), { wrapper });
    await act(() => result.current.handleCheckout("starter"));

    expect(createCheckout).toHaveBeenCalledWith("starter");
    expect(window.location.href).toBe("https://checkout.stripe.com/test");
  });

  it("handlePortal redirects to portal URL", async () => {
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
    });
    vi.mocked(createPortal).mockResolvedValue({
      data: { portal_url: "https://billing.stripe.com/test" },
    });

    const { result } = renderHook(() => useBillingViewModel(), { wrapper });
    await act(() => result.current.handlePortal());

    expect(createPortal).toHaveBeenCalled();
    expect(window.location.href).toBe("https://billing.stripe.com/test");
  });
});
