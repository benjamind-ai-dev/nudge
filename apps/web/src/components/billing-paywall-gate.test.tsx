import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { BillingPaywallGate } from "./billing-paywall-gate";

vi.mock("../queries/use-billing", () => ({
  useBillingStatus: vi.fn(),
}));

import { useBillingStatus } from "../queries/use-billing";

function PaywallContent() {
  return <div data-testid="paywall">Billing Paywall</div>;
}

function DashboardPage() {
  return <div data-testid="dashboard">Dashboard</div>;
}

function renderGate() {
  return render(
    <MemoryRouter initialEntries={["/onboarding/billing"]}>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route element={<BillingPaywallGate />}>
          <Route path="/onboarding/billing" element={<PaywallContent />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function mockBillingStatus(value: unknown) {
  vi.mocked(useBillingStatus).mockReturnValue(
    value as ReturnType<typeof useBillingStatus>,
  );
}

describe("BillingPaywallGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a spinner while loading", () => {
    mockBillingStatus({ data: undefined, isLoading: true, isError: false });
    renderGate();
    expect(screen.queryByTestId("paywall")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("redirects to /dashboard when billing status is active (paid user)", () => {
    mockBillingStatus({
      data: { status: "active" },
      isLoading: false,
      isError: false,
    });
    renderGate();
    expect(screen.getByTestId("dashboard")).toBeInTheDocument();
    expect(screen.queryByTestId("paywall")).not.toBeInTheDocument();
  });

  it("renders the paywall (Outlet) when billing status is trial (not paid)", () => {
    mockBillingStatus({
      data: { status: "trial" },
      isLoading: false,
      isError: false,
    });
    renderGate();
    expect(screen.getByTestId("paywall")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
  });

  it("renders the paywall when billing status is past_due", () => {
    mockBillingStatus({
      data: { status: "past_due" },
      isLoading: false,
      isError: false,
    });
    renderGate();
    expect(screen.getByTestId("paywall")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
  });

  it("renders the paywall when billing status is canceled", () => {
    mockBillingStatus({
      data: { status: "canceled" },
      isLoading: false,
      isError: false,
    });
    renderGate();
    expect(screen.getByTestId("paywall")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
  });

  it("fails toward paywall on query error (data undefined)", () => {
    mockBillingStatus({ data: undefined, isLoading: false, isError: true });
    renderGate();
    expect(screen.getByTestId("paywall")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
  });
});
