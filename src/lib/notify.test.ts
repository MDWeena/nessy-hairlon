import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));

import { notify } from "./notify";

const BODY = {
  type: "new_booking" as const,
  booking: {
    id: "b1", client_name: "Ada", client_email: null, client_phone: "080", booking_date: "2026-10-20",
    booking_time: "10:00 AM", status: "pending_review" as const, quoted_price: null,
  },
};

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

afterEach(() => vi.unstubAllGlobals());

describe("notify", () => {
  it("reports the server's email failure instead of swallowing it", async () => {
    mockFetch(502, { success: false, sent: false, error: "Email could not be sent (validation_error: domain not verified)" });
    expect(await notify(BODY)).toEqual({ status: "failed", error: "Email could not be sent (validation_error: domain not verified)" });
  });

  it("distinguishes sent from skipped", async () => {
    mockFetch(200, { success: true, sent: true });
    expect(await notify(BODY)).toEqual({ status: "sent" });
    mockFetch(200, { success: true, sent: false, skipped: true });
    expect(await notify(BODY)).toEqual({ status: "skipped" });
  });

  it("never throws, even when the request itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("network down"); }));
    expect(await notify(BODY)).toEqual({ status: "failed", error: "Couldn't reach the notification service" });
  });
});
