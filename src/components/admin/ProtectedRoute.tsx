import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../../hooks/useAuth";
import { AdminLoader } from "../loaders/AdminLoader";
import { AdminLogin } from "../../pages/AdminLogin";

interface ProtectedRouteProps {
  children: ReactNode;
  onBack: () => void;
}

/**
 * Guards all admin content behind a valid Supabase session. While the initial
 * session check is in flight, shows AdminLoader; if unauthenticated, renders
 * the login screen instead of `children` — no admin UI or data fetch ever
 * mounts without a session. Also arms the inactivity-timeout for as long as
 * this route is mounted.
 */
export function ProtectedRoute({ children, onBack }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, setAdminContextActive } = useAuth();

  useEffect(() => {
    setAdminContextActive(true);
    return () => setAdminContextActive(false);
  }, [setAdminContextActive]);

  if (isLoading) return <AdminLoader />;
  if (!isAuthenticated) return <AdminLogin onBack={onBack} />;
  return <>{children}</>;
}
