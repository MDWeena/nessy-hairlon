/**
 * Lets any open form save itself before the page reloads onto a newer build, and lets the update
 * logic know whether reloading now would interrupt someone mid-form. Forms register while mounted;
 * every storage access is wrapped, since sessionStorage can throw (private mode, quota, disabled).
 */
interface DraftEntry {
  /** Persist the form so it can be restored after a reload. */
  save: () => void;
  /** True while the person has started filling the form in. */
  inProgress: () => boolean;
}

const entries = new Set<DraftEntry>();

export function registerDraft(entry: DraftEntry): () => void {
  entries.add(entry);
  return () => { entries.delete(entry); };
}

export function saveAllDrafts(): void {
  for (const e of entries) {
    try { e.save(); } catch (err) { console.error("Couldn't save form draft", err); }
  }
}

export function anyFormInProgress(): boolean {
  for (const e of entries) {
    try { if (e.inProgress()) return true; } catch { /* treat as not in progress */ }
  }
  return false;
}

/** Save every open form, then reload (the reload fetches the latest build from the network). */
export function reloadPreservingDrafts(reload: () => void = () => window.location.reload()): void {
  saveAllDrafts();
  reload();
}

export function readSession<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeSession(key: string, value: unknown): void {
  try { window.sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

export function removeSession(key: string): void {
  try { window.sessionStorage.removeItem(key); } catch { /* storage unavailable */ }
}
