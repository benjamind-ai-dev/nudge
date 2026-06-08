import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { OnboardingGate } from "./onboarding-gate";

vi.mock("../queries/use-businesses", () => ({
  useBusinesses: vi.fn(),
}));

vi.mock("../queries/use-billing", () => ({
  useBillingStatus: vi.fn(),
}));

import { useBusinesses } from "../queries/use-businesses";
import { useBillingStatus } from "../queries/use-billing";

function OnboardingContent() {
  return <div data-testid="onboarding">Onboarding</div>;
}

function DashboardPage() {
  return <div data-testid="dashboard">Dashboard</div>;
}

function renderGate() {
  return render(
    <MemoryRouter initialEntries={["/onboarding"]}>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route element={<OnboardingGate />}>
          <Route path="/onboarding" element={<OnboardingContent />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function mockBusinesses(value: unknown) {
  vi.mocked(useBusinesses).mockReturnValue(
    value as ReturnType<typeof useBusinesses>,
  );
}

function mockBillingStatus(value: unknown) {
  vi.mocked(useBillingStatus).mockReturnValue(
    value as ReturnType<typeof useBillingStatus>,
  );
}

const connectedBusiness = {
  id: "biz-1",
  name: "Acme",
  accountingProvider: "quickbooks",
  connections: [{ provider: "quickbooks", status: "connected" }],
};

const unconnectedBusiness = {
  id: "biz-2",
  name: "Beta",
  accountingProvider: "xero",
  connections: [],
};

describe("OnboardingGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a spinner while businesses are loading", () => {
    mockBusinesses({ data: undefined, isLoading: true, isError: false });
    mockBillingStatus({
      data: { status: "trial", limits: { maxBusinesses: 1 } },
      isLoading: false,
      isError: false,
    });
    renderGate();
    expect(screen.queryByTestId("onboarding")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows a spinner while billing is loading", () => {
    mockBusinesses({
      data: [],
      isLoading: false,
      isError: false,
    });
    mockBillingStatus({ data: undefined, isLoading: true, isError: false });
    renderGate();
    expect(screen.queryByTestId("onboarding")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders onboarding (Outlet) when 0 connected businesses and max is 1", () => {
    mockBusinesses({ data: [], isLoading: false, isError: false });
    mockBillingStatus({
      data: { status: "trial", limits: { maxBusinesses: 1 } },
      isLoading: false,
      isError: false,
    });
    renderGate();
    expect(screen.getByTestId("onboarding")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
  });

  it("redirects to /dashboard when connected count equals max (1 connected, max 1)", () => {
    mockBusinesses({
      data: [connectedBusiness],
      isLoading: false,
      isError: false,
    });
    mockBillingStatus({
      data: { status: "active", limits: { maxBusinesses: 1 } },
      isLoading: false,
      isError: false,
    });
    renderGate();
    expect(screen.getByTestId("dashboard")).toBeInTheDocument();
    expect(screen.queryByTestId("onboarding")).not.toBeInTheDocument();
  });

  it("renders onboarding when connected count is below max (1 connected, max 5)", () => {
    mockBusinesses({
      data: [connectedBusiness],
      isLoading: false,
      isError: false,
    });
    mockBillingStatus({
      data: { status: "active", limits: { maxBusinesses: 5 } },
      isLoading: false,
      isError: false,
    });
    renderGate();
    expect(screen.getByTestId("onboarding")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
  });

  it("redirects to /dashboard when connected count equals max (5 connected, max 5)", () => {
    const fiveConnected = Array.from({ length: 5 }, (_, i) => ({
      id: `biz-${i}`,
      name: `Business ${i}`,
      accountingProvider: "quickbooks",
      connections: [{ provider: "quickbooks", status: "connected" }],
    }));
    mockBusinesses({ data: fiveConnected, isLoading: false, isError: false });
    mockBillingStatus({
      data: { status: "active", limits: { maxBusinesses: 5 } },
      isLoading: false,
      isError: false,
    });
    renderGate();
    expect(screen.getByTestId("dashboard")).toBeInTheDocument();
    expect(screen.queryByTestId("onboarding")).not.toBeInTheDocument();
  });

  it("fails open toward onboarding on businesses query error", () => {
    mockBusinesses({ data: undefined, isLoading: false, isError: true });
    mockBillingStatus({
      data: { status: "active", limits: { maxBusinesses: 1 } },
      isLoading: false,
      isError: false,
    });
    renderGate();
    expect(screen.getByTestId("onboarding")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
  });

  it("uses maxBusinesses default of 1 when limits are absent", () => {
    // data undefined → connectedCount 0, max defaults to 1 → 0 >= 1 false → show onboarding
    mockBusinesses({ data: [unconnectedBusiness], isLoading: false, isError: false });
    mockBillingStatus({
      data: { status: "trial" },
      isLoading: false,
      isError: false,
    });
    renderGate();
    expect(screen.getByTestId("onboarding")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
  });
});
