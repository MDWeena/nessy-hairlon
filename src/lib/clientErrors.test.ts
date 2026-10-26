import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FriendlyError, GENERIC_MESSAGE, NETWORK_MESSAGE, REFRESH_MESSAGES, SLOT_TAKEN_MESSAGE, toClientError } from "./clientErrors";
import { RescheduleRequestError } from "./rescheduleApi";

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => { consoleError = vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => consoleError.mockRestore());

/** What staging returned on 25 Oct for the pre-16 Oct frontend's direct insert (023 applied). */
const STALE_INSERT = { code: "42501", details: null, hint: null, message: 'new row violates row-level security policy for table "bookings"' };

/** No database / API internals may ever appear in what the client sees. */
function expectNoRawText(shown: string) {
  for (const leak of ["row-level", "violates", "42501", "PGRST", "policy", "function", "jwt", "supabase", "bookings\""]) {
    expect(shown.toLowerCase()).not.toContain(leak.toLowerCase());
  }
}

describe("toClientError", () => {
  it("the stale-client RLS failure → refresh prompt, raw text only in the console", () => {
    const r = toClientError(STALE_INSERT, "booking");
    expect(r).toEqual({ kind: "refresh_needed", message: REFRESH_MESSAGES.booking });
    expect(r.message).toBe("This page needs a quick refresh to finish your booking. Your details are saved.");
    expectNoRawText(r.message);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("refresh_needed"), STALE_INSERT);
  });

  it.each([
    ["HTTP 401", { status: 401, message: "Unauthorized" }],
    ["HTTP 403", { status: 403, message: "Forbidden" }],
    ["permission denied (42501)", { code: "42501", message: "permission denied for function cancel_booking" }],
    ["function not found (PGRST202)", { code: "PGRST202", message: "Could not find the function public.reschedule_booking(p_new_date, p_new_time, p_phone, p_reference) in the schema cache" }],
    ["undefined function (42883)", { code: "42883", message: "function public.old_thing() does not exist" }],
    ["rejected JWT (PGRST301)", { code: "PGRST301", message: "JWT expired" }],
  ])("%s → refresh prompt", (_label, err) => {
    const booking = toClientError(err, "booking");
    const track = toClientError(err, "track");
    expect(booking.kind).toBe("refresh_needed");
    expect(track).toEqual({ kind: "refresh_needed", message: "This page needs a quick refresh to continue. Your details are saved." });
    expectNoRawText(booking.message);
  });

  it.each([
    ["fetch TypeError (Chrome)", new TypeError("Failed to fetch")],
    ["fetch TypeError (Safari)", new TypeError("Load failed")],
    ["Firefox", new TypeError("NetworkError when attempting to fetch resource.")],
  ])("network: %s → connection message", (_label, err) => {
    expect(toClientError(err)).toEqual({ kind: "network", message: NETWORK_MESSAGE });
  });

  it("slot taken (SLOT_UNAVAILABLE or the unique index) → pick another slot", () => {
    expect(toClientError({ code: "P0001", message: "SLOT_UNAVAILABLE" })).toEqual({ kind: "slot_taken", message: SLOT_TAKEN_MESSAGE });
    expect(toClientError({ code: "23505", message: 'duplicate key value violates unique constraint "bookings_date_time_unique"' }))
      .toEqual({ kind: "slot_taken", message: SLOT_TAKEN_MESSAGE });
  });

  it("our own client-facing database messages (P0001 sentences) pass through", () => {
    expect(toClientError({ code: "P0001", message: "This appointment has already been reviewed" }))
      .toEqual({ kind: "invalid_input", message: "This appointment has already been reviewed" });
  });

  it("anything unrecognised → generic message, never the raw text", () => {
    for (const err of [
      { code: "XX000", message: "internal error: could not open relation 1663/5/16384" },
      { code: "P0001", message: "INVALID_ACTOR" },
      new Error("column bookings.foo does not exist"),
      "some string",
      null,
      undefined,
    ]) {
      const r = toClientError(err);
      expect(r).toEqual({ kind: "unknown", message: GENERIC_MESSAGE });
    }
  });

  it("errors written for clients are shown as-is", () => {
    expect(toClientError(new FriendlyError("Please enter your name and phone number.")).message).toBe("Please enter your name and phone number.");
    expect(toClientError(new RescheduleRequestError("TOO_LATE", "Your appointment is too close to reschedule online.", 1)))
      .toEqual({ kind: "invalid_input", message: "Your appointment is too close to reschedule online." });
  });
});
