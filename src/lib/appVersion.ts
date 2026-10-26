import { anyFormInProgress, readSession, reloadPreservingDrafts, writeSession } from "./formDrafts.js";

/**
 * Build-version check. vite.config.ts bakes a build ID into the bundle (__APP_BUILD_ID__) and
 * writes the same ID to /version.json, which vercel.json serves with no-cache headers. If the
 * deployed version differs from the one running, this copy is stale — e.g. an installed iPhone
 * app that sat suspended for days — and would hit backend paths that no longer exist.
 */
export const BUILD_ID: string = typeof __APP_BUILD_ID__ === "string" ? __APP_BUILD_ID__ : "dev";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/** The deployed build ID, or null if it can't be determined (offline, dev server, bad JSON). */
export async function fetchDeployedBuildId(fetcher: Fetcher = (i, n) => fetch(i, n)): Promise<string | null> {
  try {
    const res = await fetcher(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { buildId?: unknown };
    return typeof json.buildId === "string" && json.buildId ? json.buildId : null;
  } catch {
    return null;
  }
}

/** True only when we positively know a different build is deployed. */
export async function isNewVersionAvailable(opts: { fetcher?: Fetcher; current?: string } = {}): Promise<boolean> {
  const current = opts.current ?? BUILD_ID;
  if (current === "dev") return false;
  const deployed = await fetchDeployedBuildId(opts.fetcher);
  return deployed !== null && deployed !== current;
}

const RELOADED_FOR_KEY = "nessy_reloaded_for_build";

export type VersionAction = "none" | "reload" | "defer";

/**
 * What to do after a background check (app start / back to the foreground). Reload straight away
 * when nobody is mid-form; with a form in progress, leave it — the check right before submitting
 * shows the refresh prompt instead. Never reload twice for the same deployed build in one session,
 * so a cache that keeps serving the old page can't trap the client in a reload loop.
 */
export function decideVersionAction(input: { stale: boolean; formInProgress: boolean; alreadyReloadedForThisBuild: boolean }): VersionAction {
  if (!input.stale || input.alreadyReloadedForThisBuild) return "none";
  return input.formInProgress ? "defer" : "reload";
}

export async function checkVersionInBackground(deps: {
  fetcher?: Fetcher;
  current?: string;
  formInProgress?: () => boolean;
  reload?: () => void;
} = {}): Promise<VersionAction> {
  const current = deps.current ?? BUILD_ID;
  if (current === "dev") return "none";
  const deployed = await fetchDeployedBuildId(deps.fetcher);
  const action = decideVersionAction({
    stale: deployed !== null && deployed !== current,
    formInProgress: (deps.formInProgress ?? anyFormInProgress)(),
    alreadyReloadedForThisBuild: deployed !== null && readSession<string>(RELOADED_FOR_KEY) === deployed,
  });
  if (action === "reload") {
    writeSession(RELOADED_FOR_KEY, deployed);
    reloadPreservingDrafts(deps.reload);
  }
  return action;
}

/** Checks on start and whenever the app comes back to the foreground. */
export function startVersionWatch(): void {
  if (BUILD_ID === "dev" || typeof document === "undefined") return;
  void checkVersionInBackground();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkVersionInBackground();
  });
}
