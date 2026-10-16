// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sendEmailChecked } from "../_lib/email";

// ─── Fakes ─────────────────────────────────────────────────────────────────────────────────

type SendResult = { data: { id: string } | null; error: { name: string; message: string } | null };
const send = vi.fn<(msg: { to: string; subject: string }) => Promise<SendResult>>();

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function () { return { emails: { send } }; }),
}));

type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
let updates: { table: string; values: Row; id: unknown }[];

/** Just enough of the supabase-js query builder for these handlers: eq/in filter rows, the
 * other filters are accepted and ignored (each test seeds only rows that should match). */
function fakeQuery(table: string) {
  const filters: [string, unknown[]][] = [];
  let updateValues: Row | null = null;
  const rows = () => (tables[table] ?? []).filter(r => filters.every(([col, vals]) => vals.includes(r[col])));
  const builder = {
    select: () => builder, order: () => builder, lte: () => builder, is: () => builder, not: () => builder,
    eq: (col: string, val: unknown) => { filters.push([col, [val]]); return builder; },
    in: (col: string, vals: unknown[]) => { filters.push([col, vals]); return builder; },
    update: (values: Row) => { updateValues = values; return builder; },
    maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
    then: (resolve: (v: unknown) => unknown) => {
      if (updateValues) {
        updates.push({ table, values: updateValues, id: filters.find(([c]) => c === "id")?.[1][0] });
        return Promise.resolve({ data: null, error: null }).then(resolve);
      }
      return Promise.resolve({ data: rows(), error: null }).then(resolve);
    },
  };
  return builder;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => fakeQuery(table),
    auth: { getUser: async (token: string) => token === "admin-token" ? { data: { user: { id: "admin" } }, error: null } : { data: { user: null }, error: new Error("bad") } },
  }),
}));

function fakeReqRes(req: Partial<VercelRequest>) {
  const out: { status: number; body: Record<string, unknown> } = { status: 0, body: {} };
  const res = {
    status(code: number) { out.status = code; return res; },
    json(body: Record<string, unknown>) { out.body = body; return res; },
  } as unknown as VercelResponse;
  return { req: { headers: { host: "nessy.test" }, ...req } as VercelRequest, res, out };
}

const REJECTED: SendResult = { data: null, error: { name: "validation_error", message: "The nessy.test domain is not verified" } };
const OK: SendResult = { data: { id: "email_1" }, error: null };

function booking(overrides: Row = {}): Row {
  return {
    id: "b1", client_name: "Ada", client_email: "ada@example.com", client_phone: "08161271343",
    booking_date: "2026-10-20", booking_time: "10:00 AM", status: "pending_review", quoted_price: 50000,
    attachment_preference: null, attachment_items: [], accessory_items: [], hair_service_cost: null,
    client_notes: null, service_ids: [], deposit_confirmed_at: null, balance_paid_at: null, ...overrides,
  };
}

beforeEach(() => {
  send.mockReset();
  tables = { bookings: [], booking_reminders: [], services: [], settings: [] };
  updates = [];
  vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("ADMIN_NOTIFICATION_EMAIL", "nessy@example.com");
  vi.stubEnv("CRON_SECRET", "cron-secret");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// ─── sendEmailChecked ──────────────────────────────────────────────────────────────────────

describe("sendEmailChecked", () => {
  it("treats Resend's resolved { error } as a failure, not a send", async () => {
    send.mockResolvedValueOnce(REJECTED);
    const result = await sendEmailChecked({ emails: { send } } as never, "from@x", { to: "a@b", subject: "s", html: "h" }, "test");
    expect(result).toEqual({ ok: false, error: "validation_error: The nessy.test domain is not verified" });
    expect(console.error).toHaveBeenCalled();
  });

  it("treats a thrown network error as a failure", async () => {
    send.mockRejectedValueOnce(new Error("fetch failed"));
    const result = await sendEmailChecked({ emails: { send } } as never, "from@x", { to: "a@b", subject: "s", html: "h" }, "test");
    expect(result).toEqual({ ok: false, error: "fetch failed" });
  });

  it("reports the Resend id on success", async () => {
    send.mockResolvedValueOnce(OK);
    const result = await sendEmailChecked({ emails: { send } } as never, "from@x", { to: "a@b", subject: "s", html: "h" }, "test");
    expect(result).toEqual({ ok: true, id: "email_1" });
  });
});

// ─── send-notification ─────────────────────────────────────────────────────────────────────

describe("send-notification", () => {
  async function call(body: unknown, auth?: string) {
    const { default: handler } = await import("../send-notification");
    const { req, res, out } = fakeReqRes({ method: "POST", body, headers: { host: "nessy.test", ...(auth ? { authorization: `Bearer ${auth}` } : {}) } });
    await handler(req, res);
    return out;
  }

  it("returns 502 with Resend's error instead of claiming success", async () => {
    tables.bookings = [booking()];
    send.mockResolvedValueOnce(REJECTED);
    const out = await call({ type: "new_booking", booking: { id: "b1" } });
    expect(out.status).toBe(502);
    expect(out.body).toMatchObject({ success: false, sent: false });
    expect(String(out.body.error)).toContain("The nessy.test domain is not verified");
  });

  it("returns sent: true only when Resend accepted it", async () => {
    tables.bookings = [booking()];
    send.mockResolvedValueOnce(OK);
    const out = await call({ type: "new_booking", booking: { id: "b1" } });
    expect(out).toEqual({ status: 200, body: { success: true, sent: true } });
  });

  it("reports an admin status-change email failure back to the admin", async () => {
    send.mockResolvedValueOnce(REJECTED);
    const out = await call({ type: "status_change", previousStatus: "pending_review", booking: booking({ status: "cancelled" }) }, "admin-token");
    expect(out.status).toBe(502);
  });

  it("skips (not fails) when there's nobody to email", async () => {
    const out = await call({ type: "status_change", previousStatus: "pending_review", booking: booking({ status: "cancelled", client_email: null }) }, "admin-token");
    expect(out).toMatchObject({ status: 200, body: { success: true, sent: false, skipped: true } });
    expect(send).not.toHaveBeenCalled();
  });

  it("only sends a legacy client_cancellation notice for a booking that really is cancelled", async () => {
    tables.bookings = [booking({ status: "confirmed" })];
    const out = await call({ type: "client_cancellation", booking: { id: "b1" } });
    expect(out.status).toBe(409);
    expect(send).not.toHaveBeenCalled();
  });
});

// ─── process-reminders ─────────────────────────────────────────────────────────────────────

describe("process-reminders", () => {
  it("leaves a reminder unsent (for the next run) when Resend rejects it, and reports the failure", async () => {
    tables.bookings = [booking({ id: "b1", status: "confirmed" }), booking({ id: "b2", status: "confirmed", client_email: "zed@example.com" })];
    tables.booking_reminders = [
      { id: "r1", booking_id: "b1", reminder_type: "24h_before" },
      { id: "r2", booking_id: "b2", reminder_type: "24h_before" },
    ];
    send.mockImplementation(async (msg) => msg.to === "ada@example.com" ? REJECTED : OK);

    const { default: handler } = await import("../process-reminders");
    const { req, res, out } = fakeReqRes({ method: "GET", headers: { host: "nessy.test", authorization: "Bearer cron-secret" } });
    await handler(req, res);

    expect(out.body).toMatchObject({ success: false, sent: 1, failed: 1, total: 2 });
    expect(out.body.failures).toEqual([{ reminderId: "r1", error: "validation_error: The nessy.test domain is not verified" }]);
    expect(updates.map(u => u.id)).toEqual(["r2"]);
  });
});

// ─── process-balance-reminders ─────────────────────────────────────────────────────────────

describe("process-balance-reminders (manual, from the admin)", () => {
  async function callManual() {
    const { default: handler } = await import("../process-balance-reminders");
    const { req, res, out } = fakeReqRes({ method: "POST", body: { bookingId: "b1" }, headers: { host: "nessy.test", authorization: "Bearer admin-token" } });
    await handler(req, res);
    return out;
  }

  it("returns the real failure and doesn't record the reminder as sent", async () => {
    tables.bookings = [booking({ status: "completed", deposit_confirmed_at: "2026-10-01T10:00:00Z" })];
    send.mockResolvedValueOnce(REJECTED);
    const out = await callManual();
    expect(out.status).toBe(502);
    expect(String(out.body.error)).toContain("The nessy.test domain is not verified");
    expect(updates).toHaveLength(0);
  });

  it("records it as sent only after Resend accepts it", async () => {
    tables.bookings = [booking({ status: "completed", deposit_confirmed_at: "2026-10-01T10:00:00Z" })];
    send.mockResolvedValueOnce(OK);
    const out = await callManual();
    expect(out).toEqual({ status: 200, body: { success: true, sent: 1 } });
    expect(updates).toHaveLength(1);
    expect(updates[0].values).toHaveProperty("balance_reminder_sent_at");
  });
});
