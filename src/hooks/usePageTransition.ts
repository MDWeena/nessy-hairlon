import { useState } from "react";
import type { NavigateFn } from "../types";

interface PageTransition {
  page: string;
  navigate: NavigateFn;
  pageLoading: boolean;
}

const DEEP_LINKABLE_PAGES = new Set(["track", "review"]);

/** Lets emailed links like "/track" or "/review" land directly on that page instead of always opening on home. */
function pageFromLocation(): string | null {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, "");
  return DEEP_LINKABLE_PAGES.has(path) ? path : null;
}

export function usePageTransition(initialPage: string = "home"): PageTransition {
  const [page, setPage] = useState(() => pageFromLocation() ?? initialPage);
  const [pageLoading, setPageLoading] = useState(false);

  const navigate: NavigateFn = (p) => {
    if (p === page) return;
    setPageLoading(true);
    window.scrollTo(0, 0);
    setTimeout(() => {
      setPage(p);
      setPageLoading(false);
      const path = p === "home" ? "/" : `/${p}`;
      window.history.replaceState(null, "", path);
    }, 600);
  };

  return { page, navigate, pageLoading };
}
