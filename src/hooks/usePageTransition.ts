import { useEffect, useState } from "react";
import type { NavigateFn } from "../types";

interface PageTransition {
  page: string;
  navigate: NavigateFn;
  pageLoading: boolean;
}

const KNOWN_PAGES = new Set(["home", "services", "about", "gallery", "book", "track", "review", "reset-password", "admin"]);

/** Lets emailed links like "/track" or "/review" land directly on that page, and lets the
 * browser's back/forward buttons map a URL back to a page (see the popstate listener below).
 *
 * BUG FIX (pre-launch audit): an unrecognized path used to resolve to `null`, which made the
 * initial-state lookup silently fall back to "home" (via `?? initialPage`) and made the
 * popstate handler just ignore the navigation — either way, the Home page rendered while the
 * URL bar kept showing the wrong path, with no 404. Returning "not-found" instead lets App.tsx
 * render a real 404 page while leaving the URL as the user typed/followed it. */
function pageFromLocation(): string {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, "");
  if (path === "") return "home";
  return KNOWN_PAGES.has(path) ? path : "not-found";
}

export function usePageTransition(): PageTransition {
  const [page, setPage] = useState(() => pageFromLocation());
  const [pageLoading, setPageLoading] = useState(false);

  // Each navigate() call below pushes a new history entry, so the phone's hardware back
  // button fires a popstate here instead of leaving the site entirely. If there's no prior
  // in-app entry (the very first page), there's nothing to intercept and the browser's
  // default back behavior (leaving the site) applies, as intended.
  useEffect(() => {
    const onPopState = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      setPage(pageFromLocation());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate: NavigateFn = (p) => {
    if (p === page) return;
    setPageLoading(true);
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    setTimeout(() => {
      setPage(p);
      setPageLoading(false);
      const path = p === "home" ? "/" : `/${p}`;
      window.history.pushState(null, "", path);
    }, 600);
  };

  return { page, navigate, pageLoading };
}
