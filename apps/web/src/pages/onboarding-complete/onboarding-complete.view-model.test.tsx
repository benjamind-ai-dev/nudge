import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { ReactNode } from "react";
import { useOnboardingCompleteViewModel } from "./onboarding-complete.view-model";

// Mock the query hooks
vi.mock("../../queries/use-businesses", () => ({
  useBusinesses: vi.fn(),
}));
vi.mock("../../queries/use-billing", () => ({
  useBillingStatus: vi.fn(),
}));

import { useBusinesses } from "../../queries/use-businesses";
import { useBillingStatus } from "../../queries/use-billing";

const mockUseBusinesses = vi.mocked(useBusinesses);
const mockUseBillingStatus = vi.mocked(useBillingStatus);

function wrapperFor(path: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
  );
}

function makeBusinesses(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `biz-${i}`,
    name: `Business ${i}`,
    accountingProvider: "quickbooks" as const,
    senderName: "Sender",
    senderEmail: "sender@example.com",
    timezone: "UTC",
    emailSignature: null,
    isActive: true,
    connections: [{ provider: "quickbooks", status: "connected" }],
  }));
}

beforeEach(() => {
  mockUseBusinesses.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useBusinesses>);

  mockUseBillingStatus.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useBillingStatus>);
});

describe("useOnboardingCompleteViewModel — success branch", () => {
  it("canAddMore is true when businesses.length < maxBusinesses (agency: 1 of 5)", () => {
    mockUseBusinesses.mockReturnValue({
      data: makeBusinesses(1),
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useBusinesses>);

    mockUseBillingStatus.mockReturnValue({
      data: {
        plan: "agency",
        status: "active",
        current_period_end: null,
        cancel_at_period_end: false,
        trial_ends_at: null,
        has_stripe_customer: true,
        limits: { maxBusinesses: 5, maxSeats: 10, maxSequencesPerBusiness: 20, sms: true },
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useBillingStatus>);

    const { result } = renderHook(() => useOnboardingCompleteViewModel(), {
      wrapper: wrapperFor("/onboarding/complete?status=success"),
    });

    expect(result.current.status).toEqual("success");
    if (result.current.status !== "success") return;
    expect(result.current.canAddMore).toBe(true);
    expect(result.current.businesses).toHaveLength(1);
    expect(result.current.businesses[0].name).toBe("Business 0");
    expect(result.current.businesses[0].accountingProvider).toBe("quickbooks");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.dashboardHref).toBe("/dashboard");
    expect(result.current.addMoreHref).toBe("/onboarding");
  });

  it("canAddMore is false when businesses.length === maxBusinesses (agency: 5 of 5)", () => {
    mockUseBusinesses.mockReturnValue({
      data: makeBusinesses(5),
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useBusinesses>);

    mockUseBillingStatus.mockReturnValue({
      data: {
        plan: "agency",
        status: "active",
        current_period_end: null,
        cancel_at_period_end: false,
        trial_ends_at: null,
        has_stripe_customer: true,
        limits: { maxBusinesses: 5, maxSeats: 10, maxSequencesPerBusiness: 20, sms: true },
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useBillingStatus>);

    const { result } = renderHook(() => useOnboardingCompleteViewModel(), {
      wrapper: wrapperFor("/onboarding/complete?status=success"),
    });

    expect(result.current.status).toEqual("success");
    if (result.current.status !== "success") return;
    expect(result.current.canAddMore).toBe(false);
  });

  it("canAddMore is false for starter/growth (maxBusinesses=1, count=1)", () => {
    mockUseBusinesses.mockReturnValue({
      data: makeBusinesses(1),
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useBusinesses>);

    mockUseBillingStatus.mockReturnValue({
      data: {
        plan: "starter",
        status: "active",
        current_period_end: null,
        cancel_at_period_end: false,
        trial_ends_at: null,
        has_stripe_customer: true,
        limits: { maxBusinesses: 1, maxSeats: 1, maxSequencesPerBusiness: 3, sms: false },
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useBillingStatus>);

    const { result } = renderHook(() => useOnboardingCompleteViewModel(), {
      wrapper: wrapperFor("/onboarding/complete?status=success"),
    });

    expect(result.current.status).toEqual("success");
    if (result.current.status !== "success") return;
    expect(result.current.canAddMore).toBe(false);
  });

  it("isLoading is true when useBusinesses is loading", () => {
    mockUseBusinesses.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as unknown as ReturnType<typeof useBusinesses>);

    const { result } = renderHook(() => useOnboardingCompleteViewModel(), {
      wrapper: wrapperFor("/onboarding/complete?status=success"),
    });

    expect(result.current.status).toEqual("success");
    if (result.current.status !== "success") return;
    expect(result.current.isLoading).toBe(true);
  });

  it("isLoading is true when useBillingStatus is loading", () => {
    mockUseBillingStatus.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as unknown as ReturnType<typeof useBillingStatus>);

    const { result } = renderHook(() => useOnboardingCompleteViewModel(), {
      wrapper: wrapperFor("/onboarding/complete?status=success"),
    });

    expect(result.current.status).toEqual("success");
    if (result.current.status !== "success") return;
    expect(result.current.isLoading).toBe(true);
  });

  it("defaults canAddMore to false (maxBusinesses=1) when limits are missing", () => {
    mockUseBusinesses.mockReturnValue({
      data: makeBusinesses(1),
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useBusinesses>);

    mockUseBillingStatus.mockReturnValue({
      data: {
        plan: "starter",
        status: "active",
        current_period_end: null,
        cancel_at_period_end: false,
        trial_ends_at: null,
        has_stripe_customer: true,
        // no limits field
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useBillingStatus>);

    const { result } = renderHook(() => useOnboardingCompleteViewModel(), {
      wrapper: wrapperFor("/onboarding/complete?status=success"),
    });

    expect(result.current.status).toEqual("success");
    if (result.current.status !== "success") return;
    // maxBusinesses defaults to 1, count is 1 → canAddMore false
    expect(result.current.canAddMore).toBe(false);
  });
});

describe("useOnboardingCompleteViewModel — error branch (unchanged)", () => {
  it("renders success copy when status=success (existing test preserved)", () => {
    mockUseBusinesses.mockReturnValue({
      data: makeBusinesses(1),
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useBusinesses>);

    mockUseBillingStatus.mockReturnValue({
      data: {
        plan: "agency",
        status: "active",
        current_period_end: null,
        cancel_at_period_end: false,
        trial_ends_at: null,
        has_stripe_customer: true,
        limits: { maxBusinesses: 5, maxSeats: 10, maxSequencesPerBusiness: 20, sms: true },
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useBillingStatus>);

    const { result } = renderHook(() => useOnboardingCompleteViewModel(), {
      wrapper: wrapperFor("/onboarding/complete?status=success"),
    });
    expect(result.current.status).toEqual("success");
    expect(result.current.title).toMatch(/connected/i);
  });

  it("renders multi-tenant guidance when reason=multiple_tenants_not_supported", () => {
    const { result } = renderHook(() => useOnboardingCompleteViewModel(), {
      wrapper: wrapperFor(
        "/onboarding/complete?status=error&reason=multiple_tenants_not_supported",
      ),
    });
    expect(result.current.status).toEqual("error");
    expect(result.current.title).toMatch(/multiple organisations/i);
    if (result.current.status !== "error") return;
    expect(result.current.body).toMatch(/reconnect.*single/i);
    expect(result.current.ctaHref).toEqual("/onboarding");
    expect(result.current.ctaLabel).toMatch(/reconnect/i);
  });

  it("renders generic tenant failure copy for reason=tenant_fetch_failed", () => {
    const { result } = renderHook(() => useOnboardingCompleteViewModel(), {
      wrapper: wrapperFor(
        "/onboarding/complete?status=error&reason=tenant_fetch_failed",
      ),
    });
    expect(result.current.status).toEqual("error");
    expect(result.current.title).toMatch(/couldn.t finish/i);
    if (result.current.status !== "error") return;
    expect(result.current.ctaHref).toEqual("/onboarding");
  });

  it.each([
    ["invalid_state"],
    ["token_exchange_failed"],
    ["internal_error"],
  ])("renders error copy for reason=%s", (reason) => {
    const { result } = renderHook(() => useOnboardingCompleteViewModel(), {
      wrapper: wrapperFor(`/onboarding/complete?status=error&reason=${reason}`),
    });
    expect(result.current.status).toEqual("error");
    expect(result.current.title.length).toBeGreaterThan(0);
    if (result.current.status !== "error") return;
    expect(result.current.body.length).toBeGreaterThan(0);
    expect(result.current.ctaHref).toEqual("/onboarding");
  });

  it("falls back to a generic error when reason is unknown", () => {
    const { result } = renderHook(() => useOnboardingCompleteViewModel(), {
      wrapper: wrapperFor(
        "/onboarding/complete?status=error&reason=wat_is_this",
      ),
    });
    expect(result.current.status).toEqual("error");
    expect(result.current.title).toMatch(/something went wrong/i);
    if (result.current.status !== "error") return;
    expect(result.current.ctaHref).toEqual("/onboarding");
  });

  it("falls back to a generic error when status is missing", () => {
    const { result } = renderHook(() => useOnboardingCompleteViewModel(), {
      wrapper: wrapperFor("/onboarding/complete"),
    });
    expect(result.current.status).toEqual("error");
    expect(result.current.title).toMatch(/something went wrong/i);
  });
});
