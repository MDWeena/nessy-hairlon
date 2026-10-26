import type { AttachmentPreference } from "../types/index.js";
import { readSession, removeSession, writeSession } from "./formDrafts.js";

/**
 * The in-progress booking form, saved to sessionStorage before a refresh onto a newer build and
 * restored afterwards so the client doesn't retype anything. A photo that finished uploading is
 * just a URL and is kept; an upload still in progress can't be restored and isn't.
 */
export interface BookingDraft {
  step: number;
  /** The chosen day as a date ("2026-10-25"), not a list index — the day list can shift. */
  dayDate: string | null;
  time: string | null;
  services: string[];
  customStyleUrl: string | null;
  customStyleDescription: string;
  styleReferenceUrls: string[];
  attachmentPreference: AttachmentPreference | null;
  client: { name: string; phone: string; email: string; notes: string; emailOptedOut: boolean };
  savedAt: number;
}

const KEY = "nessy_booking_draft";
/** Old drafts aren't worth restoring — the chosen slot may long since be gone. */
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

export const EMPTY_CLIENT: BookingDraft["client"] = { name: "", phone: "", email: "", notes: "", emailOptedOut: false };

export function saveBookingDraft(draft: Omit<BookingDraft, "savedAt">, now = Date.now()): void {
  writeSession(KEY, { ...draft, savedAt: now });
}

export function loadBookingDraft(now = Date.now()): BookingDraft | null {
  const d = readSession<BookingDraft>(KEY);
  if (!d || typeof d !== "object" || typeof d.savedAt !== "number" || now - d.savedAt > MAX_AGE_MS) return null;
  if (!Array.isArray(d.services) || !Array.isArray(d.styleReferenceUrls) || !d.client) return null;
  return { ...d, client: { ...EMPTY_CLIENT, ...d.client } };
}

export function clearBookingDraft(): void {
  removeSession(KEY);
}

/** True once the client has chosen or typed anything worth keeping. */
export function draftHasProgress(d: Omit<BookingDraft, "savedAt">): boolean {
  const c = d.client;
  return !!(d.dayDate || d.time || d.services.length || d.customStyleUrl || d.customStyleDescription.trim()
    || d.styleReferenceUrls.length || d.attachmentPreference || c.name.trim() || c.phone.trim() || c.email.trim() || c.notes.trim());
}
