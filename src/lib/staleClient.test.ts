import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearBookingDraft, loadBookingDraft, saveBookingDraft, type BookingDraft } from "./bookingDraft";
import { anyFormInProgress, registerDraft, reloadPreservingDrafts } from "./formDrafts";
import { checkVersionInBackground, decideVersionAction, isNewVersionAvailable } from "./appVersion";

const DRAFT: Omit<BookingDraft, "savedAt"> = {
  step: 2, dayDate: "2026-10-30", time: "4:00 PM", services: ["Knotless Braids"],
  customStyleUrl: "https://res.cloudinary.com/demo/image/upload/style.jpg", customStyleDescription: "Waist length",
  styleReferenceUrls: ["https://www.instagram.com/p/abc/"], attachmentPreference: "nessy_buys",
  client: { name: "Ada Obi", phone: "0816 127 1343", email: "ada@example.com", notes: "Allergic to X", emailOptedOut: false },
};

beforeEach(() => { sessionStorage.clear(); });
afterEach(() => vi.restoreAllMocks());

describe("booking draft across a reload", () => {
  it("round-trips everything through sessionStorage", () => {
    saveBookingDraft(DRAFT, 1_000);
    // A reload only keeps sessionStorage — read it back cold.
    const restored = loadBookingDraft(1_000 + 60_000);
    expect(restored).toEqual({ ...DRAFT, savedAt: 1_000 });
  });

  it("works through registerDraft + reloadPreservingDrafts, the path the refresh button uses", () => {
    const unregister = registerDraft({ save: () => saveBookingDraft(DRAFT), inProgress: () => true });
    const reload = vi.fn();
    reloadPreservingDrafts(reload);
    expect(reload).toHaveBeenCalledOnce();
    expect(loadBookingDraft()?.client.name).toBe("Ada Obi");
    expect(anyFormInProgress()).toBe(true);
    unregister();
    expect(anyFormInProgress()).toBe(false);
  });

  it("ignores stale or malformed drafts, and clears after booking", () => {
    saveBookingDraft(DRAFT, 0);
    expect(loadBookingDraft(3 * 60 * 60 * 1000)).toBeNull();
    sessionStorage.setItem("nessy_booking_draft", "{not json");
    expect(loadBookingDraft()).toBeNull();
    saveBookingDraft(DRAFT);
    clearBookingDraft();
    expect(loadBookingDraft()).toBeNull();
  });

  it("never throws when storage is unavailable (private mode, quota)", () => {
    // Some browsers (storage disabled, sandboxed iframes) throw on merely reading the property.
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => { throw new DOMException("denied", "SecurityError"); });
    expect(() => saveBookingDraft(DRAFT)).not.toThrow();
    expect(loadBookingDraft()).toBeNull();
    expect(() => reloadPreservingDrafts(() => {})).not.toThrow();
  });
});

const versionFetcher = (buildId: string | null, ok = true) => vi.fn(async () => ({
  ok, json: async () => (buildId === null ? {} : { buildId }),
}) as unknown as Response);

describe("build version check", () => {
  it("does nothing when the deployed build matches", async () => {
    const reload = vi.fn();
    expect(await isNewVersionAvailable({ fetcher: versionFetcher("abc1234-x"), current: "abc1234-x" })).toBe(false);
    expect(await checkVersionInBackground({ fetcher: versionFetcher("abc1234-x"), current: "abc1234-x", formInProgress: () => false, reload })).toBe("none");
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads (saving drafts first) when a newer build is deployed and no form is open", async () => {
    const reload = vi.fn();
    const save = vi.fn();
    const unregister = registerDraft({ save, inProgress: () => false });
    expect(await checkVersionInBackground({ fetcher: versionFetcher("new0000-y"), current: "old0000-x", reload })).toBe("reload");
    expect(save).toHaveBeenCalled();
    expect(reload).toHaveBeenCalledOnce();
    unregister();
  });

  it("defers (no reload mid-typing) when a form is in progress — the pre-submit check prompts instead", async () => {
    const reload = vi.fn();
    expect(await checkVersionInBackground({ fetcher: versionFetcher("new0000-y"), current: "old0000-x", formInProgress: () => true, reload })).toBe("defer");
    expect(reload).not.toHaveBeenCalled();
    expect(await isNewVersionAvailable({ fetcher: versionFetcher("new0000-y"), current: "old0000-x" })).toBe(true);
  });

  it("reloads at most once per deployed build per session (no reload loop)", async () => {
    const reload = vi.fn();
    const deps = { fetcher: versionFetcher("new0000-y"), current: "old0000-x", formInProgress: () => false, reload };
    expect(await checkVersionInBackground(deps)).toBe("reload");
    expect(await checkVersionInBackground(deps)).toBe("none");
    expect(reload).toHaveBeenCalledOnce();
  });

  it("does nothing if version.json can't be read, or in dev", async () => {
    expect(await isNewVersionAvailable({ fetcher: versionFetcher(null, false), current: "old0000-x" })).toBe(false);
    expect(await isNewVersionAvailable({ fetcher: vi.fn(async () => { throw new TypeError("Failed to fetch"); }), current: "old0000-x" })).toBe(false);
    expect(await isNewVersionAvailable({ fetcher: versionFetcher("new0000-y"), current: "dev" })).toBe(false);
  });

  it("decision table", () => {
    expect(decideVersionAction({ stale: false, formInProgress: false, alreadyReloadedForThisBuild: false })).toBe("none");
    expect(decideVersionAction({ stale: true, formInProgress: false, alreadyReloadedForThisBuild: false })).toBe("reload");
    expect(decideVersionAction({ stale: true, formInProgress: true, alreadyReloadedForThisBuild: false })).toBe("defer");
    expect(decideVersionAction({ stale: true, formInProgress: false, alreadyReloadedForThisBuild: true })).toBe("none");
  });
});
