import { useCallback } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useInactivityTimeout } from "../../hooks/useInactivityTimeout";
import { AdminLoader } from "../loaders/AdminLoader";
import { AdminLogin } from "../../pages/AdminLogin";
import { SessionToast } from "../ui/SessionToast";

interface ProtectedRouteProps {
  children: ReactNode;
  onBack: () => void;
  /** Called after an idle sign-out completes, so the caller can navigate away and surface
   * its own "signed out" notice — this component unmounts as part of that navigation, so it
   * can't show that notice itself. */
  onInactivityLogout: () => void;
}

/**
 * Guards all admin content behind a valid Supabase session. While the initial
 * session check is in flight, shows AdminLoader; if unauthenticated, renders
 * the login screen instead of `children` — no admin UI or data fetch ever
 * mounts without a session. Also arms the 15-minute inactivity timeout for as
 * long as this route is mounted — i.e. only ever while viewing the admin UI
 * as an authenticated user, never for public-site visitors.
 */
export function ProtectedRoute({ children, onBack, onInactivityLogout }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, signOut } = useAuth();

  const handleTimeout = useCallback(async () => {
    await signOut();
    onInactivityLogout();
  }, [signOut, onInactivityLogout]);

  const { warning, resetTimer } = useInactivityTimeout({
    enabled: isAuthenticated,
    onTimeout: handleTimeout,
  });

  if (isLoading) return <AdminLoader />;
  if (!isAuthenticated) return <AdminLogin onBack={onBack} />;

  return (
    <>
      {children}
      {warning && (
        <SessionToast
          message="Your session will expire in 2 minutes due to inactivity."
          actionLabel="Stay Logged In"
          onAction={resetTimer}
        />
      )}
    </>
  );
}
