import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks: an in-memory bookings table behind the supabase-js calls useBookings makes ──────
const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  updates: [] as { id: unknown; values: Record<string, unknown> }[],
  reminderInserts: [] as unknown[],
  upserts: [] as { table: string; values: Record<string, unknown>; options: unknown }[],
}));

vi.mock("../lib/supabase", () => {
  const query = (table: string) => {
    let values: Record<string, unknown> | null = null;
    const b = {
      select: () => b, order: () => b,
      update: (v: Record<string, unknown>) => { values = v; return b; },
      upsert: (v: Record<string, unknown>, options: unknown) => { state.upserts.push({ table, values: v, options }); return Promise.resolve({ error: null }); },
      insert: (rows: unknown) => { if (table === "booking_reminders") state.reminderInserts.push(rows); return Promise.resolve({ error: null }); },
      eq: (_col: string, id: unknown) => {
        if (values) {
          state.updates.push({ id, values });
          const row = state.rows.find(r => r.id === id);
          if (row) Object.assign(row, values);
          return Promise.resolve({ error: null });
        }
        return b;
      },
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: table === "bookings" ? state.rows.map(r => ({ ...r })) : [], error: null }).then(resolve),
    };
    return b;
  };
  return {
    supabase: {
      from: query,
      auth: { getSession: async () => ({ data: { session: { access_token: "t" } }, error: null }), signOut: async () => {} },
    },
  };
});

const notify = vi.fn(async () => ({ status: "sent" as const }));
vi.mock("../lib/notify", () => ({ notify: (...args: unknown[]) => notify(...(args as [])) }));
vi.mock("./useSettings", () => ({ useSettings: () => ({ settings: { deposit_percentage: 50 } }) }));

import { useBookings } from "./useBookings";

function booking(over: Record<string, unknown>) {
  return {
    id: "b1", client_name: "Ada", client_phone: "08161271343", client_email: "ada@example.com",
    booking_date: "2026-10-20", booking_time: "10:00 AM", service_ids: [], status: "confirmed", quoted_price: 50000,
    deposit_confirmed_at: "2026-10-10T10:00:00Z", balance_paid_at: null, attachment_items: [], accessory_items: [],
    style_reference_urls: [], ...over,
  };
}

async function setup(rows: Record<string, unknown>[]) {
  state.rows = rows;
  const hook = renderHook(() => useBookings());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

beforeEach(() => {
  state.updates = [];
  state.reminderInserts = [];
  state.upserts = [];
  notify.mockClear();
});

describe("Mark Completed", () => {
  it("moves confirmed → completed and sends the thank-you (completed status_change) email", async () => {
    const { result } = await setup([booking({})]);
    let outcome: unknown;
    await act(async () => { outcome = await result.current.markCompleted("b1", true); });
    expect(state.updates.map(u => u.values.status)).toEqual(["completed"]);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0]).toEqual([expect.objectContaining({ type: "status_change", previousStatus: "confirmed", booking: expect.objectContaining({ status: "completed" }) })]);
    expect(outcome).toEqual({ status: "sent" });
  });

  it("sends no email when the thank-you box is unticked", async () => {
    const { result } = await setup([booking({})]);
    let outcome: unknown;
    await act(async () => { outcome = await result.current.markCompleted("b1", false); });
    expect(state.updates.map(u => u.values.status)).toEqual(["completed"]);
    expect(notify).not.toHaveBeenCalled();
    expect(outcome).toBeNull();
  });

  it("surfaces an email failure without undoing the change", async () => {
    notify.mockResolvedValueOnce({ status: "failed", error: "Email could not be sent" } as never);
    const { result } = await setup([booking({})]);
    let outcome: unknown;
    await act(async () => { outcome = await result.current.markCompleted("b1", true); });
    expect(outcome).toEqual({ status: "failed", error: "Email could not be sent" });
    expect(state.rows[0].status).toBe("completed");
  });
});

describe("Move back to Confirmed", () => {
  it("moves completed → confirmed, sends nothing, and doesn't recreate reminders", async () => {
    const { result } = await setup([booking({ status: "completed", booking_date: "2099-01-05" })]);
    await act(async () => { await result.current.moveBackToConfirmed("b1"); });
    expect(state.updates.map(u => u.values.status)).toEqual(["confirmed"]);
    expect(notify).not.toHaveBeenCalled();
    expect(state.reminderInserts).toEqual([]);
  });
});

describe("Mark Completed on a past quoted / deposit-paid booking (no deposit step)", () => {
  const quoted = (over: Record<string, unknown> = {}) => booking({ status: "quoted", deposit_confirmed_at: null, quoted_price: 20000, ...over });

  it("'Client paid in full on the day': records the full price as today's balance in the ledger and completes it", async () => {
    const { result } = await setup([quoted()]);
    const before = Date.now();
    await act(async () => { await result.current.completeWithoutConfirming("b1", { paidInFull: true, sendThankYou: true, productCost: 3000 }); });
    const patch = state.updates[0].values;
    expect(patch).toMatchObject({ product_cost: 3000 });
    expect(Date.parse(patch.balance_paid_at as string)).toBeGreaterThanOrEqual(before);
    expect(state.upserts).toHaveLength(1);
    expect(state.upserts[0]).toMatchObject({ table: "payments", values: { booking_id: "b1", kind: "balance", amount: 20000, source: "app" }, options: { onConflict: "booking_id,kind", ignoreDuplicates: true } });
    expect(Date.parse(state.upserts[0].values.received_at as string)).toBeGreaterThanOrEqual(before);
    expect(state.updates.map(u => u.values.status).filter(Boolean)).toEqual(["completed"]);
    expect(notify.mock.calls[0]).toEqual([expect.objectContaining({ type: "status_change", previousStatus: "quoted", booking: expect.objectContaining({ status: "completed" }) })]);
  });

  it("unticked: completes it with the balance still outstanding — no payment recorded", async () => {
    const { result } = await setup([quoted()]);
    await act(async () => { await result.current.completeWithoutConfirming("b1", { paidInFull: false, sendThankYou: false }); });
    expect(state.upserts).toEqual([]);
    expect(state.updates[0].values).not.toHaveProperty("balance_paid_at");
    expect(state.updates.map(u => u.values.status).filter(Boolean)).toEqual(["completed"]);
    expect(notify).not.toHaveBeenCalled();
  });

  it("works for deposit_paid too (the unchecked deposit isn't counted — the full price is the balance)", async () => {
    const { result } = await setup([quoted({ status: "deposit_paid" })]);
    await act(async () => { await result.current.completeWithoutConfirming("b1", { paidInFull: true, sendThankYou: false }); });
    expect(state.upserts[0].values).toMatchObject({ kind: "balance", amount: 20000 });
  });

  it("refuses a booking that's no longer quoted / deposit paid, and paid-in-full without a price", async () => {
    const { result } = await setup([booking({ status: "confirmed" }), quoted({ id: "b2", quoted_price: null })]);
    await expect(result.current.completeWithoutConfirming("b1", { paidInFull: true, sendThankYou: false })).rejects.toThrow(/can't be completed/);
    await expect(result.current.completeWithoutConfirming("b2", { paidInFull: true, sendThankYou: false })).rejects.toThrow(/Set a price first/);
    expect(state.updates).toEqual([]);
    expect(state.upserts).toEqual([]);
  });
});

describe("Cancel booking (a quoted appointment that never happened)", () => {
  it("cancels without emailing the client", async () => {
    const { result } = await setup([booking({ status: "quoted", deposit_confirmed_at: null })]);
    await act(async () => { await result.current.cancelBooking("b1"); });
    expect(state.updates.map(u => u.values.status)).toEqual(["cancelled"]);
    expect(notify).not.toHaveBeenCalled();
  });
});
