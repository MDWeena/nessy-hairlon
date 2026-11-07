// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { handleClientCancel, handleClientReschedule, type RescheduleEnv, type RescheduleRepo } from "../_lib/reschedule";
import { renderReminderEmail } from "../_lib/reminderProcessor";
import type { RenderedEmail } from "../_lib/rescheduleEmails";
import type { Database } from "../../src/types/database";

/**
 * Rule 7: the private product cost must never reach a client. The production repo reads whole
 * booking rows (select("*")), so every client-facing route and email is fed a row carrying a
 * product cost and note, and none of what they return or send may contain them.
 */
const SECRET_COST = 98765;
const SECRET_NOTE = "secret-supplier-note";

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
const row = (over: Partial<BookingRow> = {}): BookingRow => ({
  id: "a1b2c3d4-0000-4000-8000-000000000001", client_name: "Ada", client_phone: "08161271343", client_email: "ada@example.com",
  booking_date: "2099-01-20", booking_time: "10:00 AM", service_ids: [], custom_style_url: null, custom_style_description: null,
  status: "confirmed", quoted_price: 50000, notes: null, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z",
  deposit_confirmed_at: "2026-10-02T00:00:00Z", payment_proof_url: null, attachment_preference: null, attachment_items: [],
  accessory_items: [], hair_service_cost: null, balance_paid_at: null, balance_reminder_sent_at: null, style_reference_urls: [],
  client_notes: null, custom_style_category: null, reference_code: "A1B2C3D4", client_reschedule_count: 0, last_rescheduled_at: null,
  product_cost: SECRET_COST, product_cost_note: SECRET_NOTE, ...over,
} as BookingRow);

function env(): { env: RescheduleEnv; sent: RenderedEmail[] } {
  const sent: RenderedEmail[] = [];
  const repo: RescheduleRepo = {
    findBookingsByReference: async () => [row()],
    getBooking: async () => row(),
    getNoticeHours: async () => 24,
    getNessyPhone: async () => "08161271343",
    reschedule: async () => ({ booking_id: row().id, old_date: "2099-01-20", old_time: "10:00 AM", new_date: "2099-01-21", new_time: "2:00 PM", rescheduled_by: "client", reason: null, client_reschedule_count: 1, reminders_scheduled: 2 }),
    cancel: async () => ({ booking_id: row().id, previous_status: "confirmed", date: "2099-01-20", time: "10:00 AM" }),
    hitRateLimit: async () => 1,
  };
  return { sent, env: { repo, sendEmail: async (e) => { sent.push(e); }, adminEmail: "nessy@example.com", verifyAdminToken: async () => true, now: () => Date.parse("2099-01-01T00:00:00Z") } };
}

const leaks = (x: unknown) => {
  const s = JSON.stringify(x);
  return s.includes(String(SECRET_COST)) || s.includes("98,765") || s.includes(SECRET_NOTE) || s.includes("product_cost");
};

describe("product cost never reaches clients", () => {
  it("reschedule-client: eligibility check, reschedule response and emails", async () => {
    const { env: e, sent } = env();
    const check = await handleClientReschedule(e, { action: "check", reference: "BK-A1B2C3D4", phone: "08161271343" }, "1.1.1.1", "https://nessy.test");
    expect(check.status).toBe(200);
    expect(leaks(check.body)).toBe(false);
    const done = await handleClientReschedule(e, { action: "reschedule", reference: "BK-A1B2C3D4", phone: "08161271343", newDate: "2099-01-21", newTime: "2:00 PM" }, "1.1.1.2", "https://nessy.test");
    expect(done.status).toBe(200);
    expect(leaks(done.body)).toBe(false);
    expect(sent.length).toBeGreaterThan(0);
    for (const m of sent) expect(leaks(m)).toBe(false);
  });

  it("cancel-client: response and emails", async () => {
    const { env: e, sent } = env();
    const res = await handleClientCancel(e, { reference: "BK-A1B2C3D4", phone: "08161271343" }, "1.1.1.3", "https://nessy.test");
    expect(res.status).toBe(200);
    expect(leaks(res.body)).toBe(false);
    for (const m of sent) expect(leaks(m)).toBe(false);
  });

  it("appointment reminder emails", () => {
    const b = { ...row(), status: "confirmed" as const };
    for (const type of ["24h_before", "2h_before"] as const) {
      const email = renderReminderEmail(type, b as never, { siteUrl: "https://nessy.test", phone: null, locationUrl: null, serviceNames: [] });
      expect(leaks(email)).toBe(false);
    }
  });

  it("the shared error path doesn't echo booking fields either", async () => {
    const { env: e } = env();
    e.repo.reschedule = vi.fn(async () => { throw new Error(`boom ${SECRET_COST}`); });
    const res = await handleClientReschedule(e, { action: "reschedule", reference: "BK-A1B2C3D4", phone: "08161271343", newDate: "2099-01-21", newTime: "2:00 PM" }, "1.1.1.4", "https://nessy.test");
    expect(leaks(res.body)).toBe(false);
  });
});
