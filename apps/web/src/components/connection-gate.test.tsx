import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { ConnectionGate } from "./connection-gate";

vi.mock("../queries/use-businesses", () => ({
  useBusinesses: vi.fn(),
}));

import { useBusinesses } from "../queries/use-businesses";

function AppContent() {
  return <div data-testid="app-content">App</div>;
}

function OnboardingPage() {
  return <div data-testid="onboarding">Onboarding</div>;
}

function renderGate() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route element={<ConnectionGate />}>
          <Route path="/dashboard" element={<AppContent />} />
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

describe("ConnectionGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a spinner while loading", () => {
    mockBusinesses({ data: undefined, isLoading: true, isError: false });
    renderGate();
    expect(screen.queryByTestId("app-content")).not.toBeInTheDocument();
    expect(screen.queryByTestId("onboarding")).not.toBeInTheDocument();
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders the app when a connected business exists", () => {
    mockBusinesses({ data: [connectedBusiness], isLoading: false, isError: false });
    renderGate();
    expect(screen.getByTestId("app-content")).toBeInTheDocument();
    expect(screen.queryByTestId("onboarding")).not.toBeInTheDocument();
  });

  it("redirects to /onboarding when no business is connected", () => {
    mockBusinesses({ data: [unconnectedBusiness], isLoading: false, isError: false });
    renderGate();
    expect(screen.getByTestId("onboarding")).toBeInTheDocument();
    expect(screen.queryByTestId("app-content")).not.toBeInTheDocument();
  });

  it("redirects to /onboarding when there are no businesses", () => {
    mockBusinesses({ data: [], isLoading: false, isError: false });
    renderGate();
    expect(screen.getByTestId("onboarding")).toBeInTheDocument();
    expect(screen.queryByTestId("app-content")).not.toBeInTheDocument();
  });

  it("fails CLOSED: redirects to /onboarding on query error (no connection confirmed)", () => {
    mockBusinesses({ data: undefined, isLoading: false, isError: true });
    renderGate();
    expect(screen.getByTestId("onboarding")).toBeInTheDocument();
    expect(screen.queryByTestId("app-content")).not.toBeInTheDocument();
  });
});
