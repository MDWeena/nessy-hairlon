import { useEffect, useState } from "react";
import type { NavigateFn } from "../types";

interface PageTransition {
  page: string;
  navigate: NavigateFn;
  pageLoading: boolean;
}

const KNOWN_PAGES = new Set(["home", "services", "about", "gallery", "book", "track", "review", "reset-password", "admin"]);

/** Lets emailed links like "/track" or "/review" land directly on that page, and lets the
 * browser's back/forward buttons map a URL back to a page (see the popstate listener below). */
function pageFromLocation(): string | null {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, "");
  if (path === "") return "home";
  return KNOWN_PAGES.has(path) ? path : null;
}

export function usePageTransition(initialPage: string = "home"): PageTransition {
  const [page, setPage] = useState(() => pageFromLocation() ?? initialPage);
  const [pageLoading, setPageLoading] = useState(false);

  // Each navigate() call below pushes a new history entry, so the phone's hardware back
  // button fires a popstate here instead of leaving the site entirely. If there's no prior
  // in-app entry (the very first page), there's nothing to intercept and the browser's
  // default back behavior (leaving the site) applies, as intended.
  useEffect(() => {
    const onPopState = () => {
      const next = pageFromLocation();
      if (next) {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        setPage(next);
      }
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
