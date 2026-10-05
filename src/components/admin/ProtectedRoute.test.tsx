import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "./ProtectedRoute";
import { useAuth } from "../../hooks/useAuth";

vi.mock("../../hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../hooks/useInactivityTimeout", () => ({
  useInactivityTimeout: () => ({ warning: false, resetTimer: vi.fn() }),
}));

vi.mock("../../pages/AdminLogin", () => ({
  AdminLogin: () => <div data-testid="admin-login">login screen</div>,
}));

vi.mock("../loaders/AdminLoader", () => ({
  AdminLoader: () => <div data-testid="admin-loader">loading…</div>,
}));

const mockUseAuth = useAuth as unknown as ReturnType<typeof vi.fn>;

describe("ProtectedRoute", () => {
  it("shows the loader while the initial session check is in flight", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: true, signOut: vi.fn() });

    render(
      <ProtectedRoute onBack={vi.fn()} onInactivityLogout={vi.fn()}>
        <div data-testid="admin-content">secret admin content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByTestId("admin-loader")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-content")).not.toBeInTheDocument();
  });

  it("blocks unauthenticated access — renders the login screen, never the children", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, signOut: vi.fn() });

    render(
      <ProtectedRoute onBack={vi.fn()} onInactivityLogout={vi.fn()}>
        <div data-testid="admin-content">secret admin content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByTestId("admin-login")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-content")).not.toBeInTheDocument();
  });

  it("allows authenticated access — renders the children, not the login screen", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false, signOut: vi.fn() });

    render(
      <ProtectedRoute onBack={vi.fn()} onInactivityLogout={vi.fn()}>
        <div data-testid="admin-content">secret admin content</div>
      </ProtectedRoute>,
    );

    expect(screen.getByTestId("admin-content")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-login")).not.toBeInTheDocument();
  });
});
