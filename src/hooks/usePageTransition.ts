import { useState } from "react";
import type { NavigateFn } from "../types";

interface PageTransition {
  page: string;
  navigate: NavigateFn;
  pageLoading: boolean;
}

export function usePageTransition(initialPage: string = "home"): PageTransition {
  const [page, setPage] = useState(initialPage);
  const [pageLoading, setPageLoading] = useState(false);

  const navigate: NavigateFn = (p) => {
    if (p === page) return;
    setPageLoading(true);
    window.scrollTo(0, 0);
    setTimeout(() => { setPage(p); setPageLoading(false); }, 600);
  };

  return { page, navigate, pageLoading };
}
