import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { ReactNode } from "react";
import { useOnboardingCompleteViewModel } from "./onboarding-complete.view-model";

function wrapperFor(path: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
  );
}

describe("useOnboardingCompleteViewModel", () => {
  it("renders success copy when status=success", () => {
    const { result } = renderHook(() => useOnboardingCompleteViewModel(), {
      wrapper: wrapperFor("/onboarding/complete?status=success"),
    });
    expect(result.current.status).toEqual("success");
    expect(result.current.title).toMatch(/connected/i);
    expect(result.current.ctaHref).toEqual("/dashboard");
  });

  it("renders multi-tenant guidance when reason=multiple_tenants_not_supported", () => {
    const { result } = renderHook(() => useOnboardingCompleteViewModel(), {
      wrapper: wrapperFor(
        "/onboarding/complete?status=error&reason=multiple_tenants_not_supported",
      ),
    });
    expect(result.current.status).toEqual("error");
    expect(result.current.title).toMatch(/multiple organisations/i);
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
