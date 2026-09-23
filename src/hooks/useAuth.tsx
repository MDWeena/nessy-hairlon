import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutes
const INACTIVITY_CHECK_INTERVAL_MS = 15 * 1000; // poll every 15s, also re-checked on tab focus
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  /** Arms/disarms the inactivity-timeout while the admin UI is mounted. Call true on mount, false on unmount. */
  setAdminContextActive: (active: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

/** Wraps Supabase Auth session state; the session is persisted automatically across reloads. */
export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const sessionRef = useRef<Session | null>(null);
  const isAdminContextRef = useRef(false);
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    await supabase.auth.signOut();
  }, []);

  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Polls elapsed idle time rather than arming a single long-lived setTimeout on
  // each activity event. A one-shot 30-minute setTimeout only ever gets (re)armed
  // by an activity event or the initial mount call — if session state finishes
  // resolving *after* the last such event (e.g. someone signs in and then walks
  // away immediately, so the click that submits the form fires before the session
  // updates), nothing ever re-arms it and the timeout silently never fires.
  // Polling sidesteps that: it just checks "how long since last activity" on an
  // interval, independent of exactly when auth state settled. It also survives
  // background-tab throttling better than a single long setTimeout, since it's
  // re-checked immediately on visibilitychange too.
  const checkInactivity = useCallback(() => {
    if (!isAdminContextRef.current || !sessionRef.current) return;
    if (Date.now() - lastActivityRef.current >= INACTIVITY_LIMIT_MS) {
      signOut();
    }
  }, [signOut]);

  useEffect(() => {
    const handleActivity = () => recordActivity();
    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, handleActivity, { passive: true }));

    const intervalId = setInterval(checkInactivity, INACTIVITY_CHECK_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") checkInactivity();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, handleActivity));
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [recordActivity, checkInactivity]);

  const setAdminContextActive = useCallback((active: boolean) => {
    isAdminContextRef.current = active;
    if (active) lastActivityRef.current = Date.now(); // start the clock fresh when entering the admin UI
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  }, []);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    isAuthenticated: !!session,
    isLoading,
    signIn,
    signOut,
    setAdminContextActive,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
