import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";

const MAX_PULL = 90;
const REFRESH_THRESHOLD = 64;
const INDICATOR_SIZE = 56;

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown> | void;
  children: ReactNode;
}

/**
 * From-scratch touch-driven pull-to-refresh (no library) — only engages when the page is
 * already scrolled to the top, so it never fights normal scrolling or a horizontal swipe
 * (e.g. StylesCarousel on Home). Rubber-band resistance while dragging, snaps back on
 * release below the threshold, and spins a gold indicator while `onRefresh` is in flight.
 */
export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [snapBack, setSnapBack] = useState(false);
  // Touch handlers close over these every render if read from state directly — a ref keeps
  // the live gesture math independent of React's render cycle, so the effect below only
  // needs to run once (per onRefresh identity) instead of re-binding on every pull update.
  const gesture = useRef({ startY: 0, dragging: false, pull: 0, refreshing: false });

  useEffect(() => {
    const g = gesture.current;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || g.refreshing) return;
      g.startY = e.touches[0].clientY;
      g.dragging = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!g.dragging) return;
      const delta = e.touches[0].clientY - g.startY;
      if (delta <= 0 || window.scrollY > 0) {
        if (g.pull !== 0) { g.pull = 0; setPull(0); }
        return;
      }
      // Diminishing returns the further it's pulled — a rubber-band feel instead of 1:1 tracking.
      const resisted = Math.min(MAX_PULL, delta * 0.5);
      g.pull = resisted;
      setSnapBack(false);
      setPull(resisted);
      if (e.cancelable) e.preventDefault();
    };

    const onTouchEnd = () => {
      if (!g.dragging) return;
      g.dragging = false;
      setSnapBack(true);
      if (g.pull >= REFRESH_THRESHOLD) {
        g.refreshing = true;
        g.pull = INDICATOR_SIZE;
        setRefreshing(true);
        setPull(INDICATOR_SIZE);
        Promise.resolve(onRefresh()).finally(() => {
          g.refreshing = false;
          g.pull = 0;
          setRefreshing(false);
          setPull(0);
        });
      } else {
        g.pull = 0;
        setPull(0);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [onRefresh]);

  const progress = Math.min(1, pull / REFRESH_THRESHOLD);

  return (
    <div className="relative">
      <div
        className="absolute left-0 right-0 flex items-center justify-center pointer-events-none z-10"
        style={{
          top: -INDICATOR_SIZE,
          height: INDICATOR_SIZE,
          transform: `translateY(${pull}px)`,
          transition: snapBack ? "transform 0.25s ease-out" : "none",
          opacity: progress,
        }}
      >
        <span className="w-8 h-8 rounded-full bg-surface border border-[#C49A6C40] flex items-center justify-center shadow-[0_2px_10px_rgba(0,0,0,0.15)]">
          <RefreshCw
            size={16} color="#C49A6C"
            style={{
              transform: refreshing ? undefined : `rotate(${progress * 360}deg)`,
              animation: refreshing ? "loaderSpin 0.7s linear infinite" : "none",
            }}
          />
        </span>
      </div>
      <div
        style={{
          transform: `translateY(${pull}px)`,
          transition: snapBack ? "transform 0.25s ease-out" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
