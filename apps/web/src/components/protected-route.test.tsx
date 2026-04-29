import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { ProtectedRoute } from "./protected-route";

vi.mock("@clerk/clerk-react", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "@clerk/clerk-react";

function TestChild() {
  return <div data-testid="protected-content">Protected Content</div>;
}

function SignInPage() {
  return <div data-testid="sign-in">Sign In Page</div>;
}

function renderWithRouter(initialEntry = "/protected") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/protected" element={<TestChild />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading spinner while Clerk is loading", () => {
    vi.mocked(useAuth).mockReturnValue({
      isLoaded: false,
      isSignedIn: undefined,
    } as unknown as ReturnType<typeof useAuth>);

    renderWithRouter();

    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sign-in")).not.toBeInTheDocument();
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("redirects to /sign-in when not authenticated", () => {
    vi.mocked(useAuth).mockReturnValue({
      isLoaded: true,
      isSignedIn: false,
    } as unknown as ReturnType<typeof useAuth>);

    renderWithRouter();

    expect(screen.getByTestId("sign-in")).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("renders child routes when authenticated", () => {
    vi.mocked(useAuth).mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
    } as unknown as ReturnType<typeof useAuth>);

    renderWithRouter();

    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    expect(screen.queryByTestId("sign-in")).not.toBeInTheDocument();
  });
});
