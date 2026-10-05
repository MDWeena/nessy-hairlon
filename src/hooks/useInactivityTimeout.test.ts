import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInactivityTimeout } from "./useInactivityTimeout";

const TIMEOUT_MS = 10_000;
const WARNING_BEFORE_MS = 3_000;

describe("useInactivityTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not warn or time out while disabled", () => {
    const onWarning = vi.fn();
    const onTimeout = vi.fn();
    renderHook(() => useInactivityTimeout({
      enabled: false, timeoutMs: TIMEOUT_MS, warningBeforeMs: WARNING_BEFORE_MS, onWarning, onTimeout,
    }));

    act(() => { vi.advanceTimersByTime(TIMEOUT_MS + 5_000); });

    expect(onWarning).not.toHaveBeenCalled();
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("fires onWarning once the remaining time drops to warningBeforeMs", () => {
    const onWarning = vi.fn();
    const { result } = renderHook(() => useInactivityTimeout({
      enabled: true, timeoutMs: TIMEOUT_MS, warningBeforeMs: WARNING_BEFORE_MS, onWarning,
    }));

    expect(result.current.warning).toBe(false);

    act(() => { vi.advanceTimersByTime(TIMEOUT_MS - WARNING_BEFORE_MS); });

    expect(result.current.warning).toBe(true);
    expect(onWarning).toHaveBeenCalledTimes(1);
  });

  it("fires onTimeout once the full duration elapses with no activity", () => {
    const onTimeout = vi.fn();
    renderHook(() => useInactivityTimeout({
      enabled: true, timeoutMs: TIMEOUT_MS, warningBeforeMs: WARNING_BEFORE_MS, onTimeout,
    }));

    act(() => { vi.advanceTimersByTime(TIMEOUT_MS); });

    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("resetTimer() dismisses the warning and restarts the clock", () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useInactivityTimeout({
      enabled: true, timeoutMs: TIMEOUT_MS, warningBeforeMs: WARNING_BEFORE_MS, onTimeout,
    }));

    act(() => { vi.advanceTimersByTime(TIMEOUT_MS - WARNING_BEFORE_MS); });
    expect(result.current.warning).toBe(true);

    act(() => { result.current.resetTimer(); });
    expect(result.current.warning).toBe(false);

    // Only a bit more time than the warning threshold, measured from the reset — should
    // not have timed out, since resetTimer() pushed the clock back to "just now".
    act(() => { vi.advanceTimersByTime(WARNING_BEFORE_MS + 1_000); });
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("a window activity event (e.g. keydown) resets the clock before it times out", () => {
    const onTimeout = vi.fn();
    renderHook(() => useInactivityTimeout({
      enabled: true, timeoutMs: TIMEOUT_MS, warningBeforeMs: WARNING_BEFORE_MS, onTimeout,
    }));

    act(() => { vi.advanceTimersByTime(TIMEOUT_MS - 1_000); });
    act(() => { window.dispatchEvent(new KeyboardEvent("keydown")); });
    act(() => { vi.advanceTimersByTime(TIMEOUT_MS - 1_000); });

    // Had the keydown not reset the clock, this much elapsed time would have fired onTimeout.
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("stops tracking (removes listeners) once disabled, so it never times out afterward", () => {
    const onTimeout = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }) => useInactivityTimeout({ enabled, timeoutMs: TIMEOUT_MS, warningBeforeMs: WARNING_BEFORE_MS, onTimeout }),
      { initialProps: { enabled: true } },
    );

    rerender({ enabled: false });
    act(() => { vi.advanceTimersByTime(TIMEOUT_MS + 5_000); });

    expect(onTimeout).not.toHaveBeenCalled();
  });
});
