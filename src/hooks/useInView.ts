import { useEffect, useRef, useState } from "react";

/**
 * Fires once when the target element scrolls into view.
 * After the first intersection the observer disconnects,
 * so `inView` latches to `true` permanently.
 */
export function useInView<T extends HTMLElement>(threshold = 0.6) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}
