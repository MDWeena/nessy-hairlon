import { useCallback, useEffect, useRef, useState } from "react";

/** Configurable here so the timeout duration is a one-line change later. */
export const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
export const INACTIVITY_WARNING_BEFORE_MS = 2 * 60 * 1000; // warn 2 minutes before timeout

const CHECK_INTERVAL_MS = 1000;
const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll"] as const;

interface UseInactivityTimeoutOptions {
  /** Listeners and the timer are only attached while this is true — e.g. gate on isAuthenticated. */
  enabled: boolean;
  timeoutMs?: number;
  warningBeforeMs?: number;
  /** Fired once, the moment the remaining time drops to warningBeforeMs. */
  onWarning?: () => void;
  /** Fired once, when the full timeoutMs has elapsed with no activity. */
  onTimeout?: () => void;
}

interface UseInactivityTimeoutResult {
  /** True from the warning point until resetTimer() is called or the timeout fires. */
  warning: boolean;
  /** Dismisses the warning and restarts the clock — wire to a "Stay logged in" button. */
  resetTimer: () => void;
}

/**
 * Tracks window-level activity (mousedown/keydown/touchstart/scroll) and fires onWarning /
 * onTimeout after the configured idle durations. Uses a polling check (rather than a single
 * setTimeout re-armed per event) so a tab that's been backgrounded and throttled still gets an
 * accurate answer the moment it's checked again. A visibilitychange handler re-checks the moment
 * the tab regains focus: if it's been hidden past the full timeout, it signs out immediately
 * instead of waiting for the next activity event; otherwise, returning to the tab counts as
 * activity and the clock restarts.
 */
export function useInactivityTimeout({
  enabled,
  timeoutMs = INACTIVITY_TIMEOUT_MS,
  warningBeforeMs = INACTIVITY_WARNING_BEFORE_MS,
  onWarning,
  onTimeout,
}: UseInactivityTimeoutOptions): UseInactivityTimeoutResult {
  const lastActivityRef = useRef(Date.now());
  const warnedRef = useRef(false);
  const timedOutRef = useRef(false);
  const [warning, setWarning] = useState(false);

  // Refs for the latest callbacks so the effect below doesn't need to restart (and reset the
  // clock) just because the caller passed a new inline function on some unrelated re-render.
  const onWarningRef = useRef(onWarning);
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => { onWarningRef.current = onWarning; }, [onWarning]);
  useEffect(() => { onTimeoutRef.current = onTimeout; }, [onTimeout]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    warnedRef.current = false;
    timedOutRef.current = false;
    setWarning(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setWarning(false);
      return;
    }
    resetTimer();

    const check = () => {
      if (timedOutRef.current) return;
      const elapsed = Date.now() - lastActivityRef.current;

      if (elapsed >= timeoutMs) {
        timedOutRef.current = true;
        setWarning(false);
        onTimeoutRef.current?.();
        return;
      }

      if (elapsed >= timeoutMs - warningBeforeMs && !warnedRef.current) {
        warnedRef.current = true;
        setWarning(true);
        onWarningRef.current?.();
      }
    };

    const handleActivity = () => {
      if (timedOutRef.current) return;
      resetTimer();
    };
    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, handleActivity, { passive: true }));

    const intervalId = setInterval(check, CHECK_INTERVAL_MS);

    // On returning to the tab: if it's been hidden past the full timeout, sign out right away
    // rather than waiting for the next activity event. Otherwise, treat switching back to the
    // tab itself as activity and give the full duration again.
    const handleVisibility = () => {
      if (document.visibilityState !== "visible" || timedOutRef.current) return;
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= timeoutMs) check();
      else resetTimer();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, handleActivity));
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, timeoutMs, warningBeforeMs, resetTimer]);

  return { warning, resetTimer };
}
