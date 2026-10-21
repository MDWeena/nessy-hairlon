import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database.js";
import type { OrderStatus } from "../../src/types/index.js";
import { decideReminder, formatLongDate, watDateOf, type ReminderType } from "../../src/lib/reminders.js";
import { shortBookingReference } from "../../src/lib/bookingReference.js";
import { buildWhatsAppUrl } from "../../src/lib/whatsapp.js";
import type { EmailMessage, EmailResult } from "./email.js";

export interface ReminderBookingRow {
  id: string;
  client_name: string;
  client_email: string | null;
  booking_date: string;
  booking_time: string;
  status: OrderStatus;
  service_ids: string[];
}

export interface UnsentReminder {
  id: string;
  booking_id: string | null;
  reminder_type: string;
  booking: ReminderBookingRow | null;
}

export interface ReminderSettings {
  phone: string | null;
  locationUrl: string | null;
}

/** Everything the processor needs from the database — an interface so the rules can be tested
 * with a fake clock and in-memory rows (api/_tests/reminderProcessor.test.ts). */
export interface ReminderRepo {
  /** Every row with sent_at IS NULL, regardless of scheduled_for, with its booking. */
  fetchUnsent(): Promise<UnsentReminder[]>;
  /** Sets sent_at only if it's still NULL; true if this call won the row. */
  claim(id: string, at: string): Promise<boolean>;
  /** Undoes a claim after a failed send, so the next run retries (and re-checks) it. */
  release(id: string, at: string): Promise<void>;
  serviceNames(ids: string[]): Promise<string[]>;
  settings(): Promise<ReminderSettings>;
}

export interface RowOutcome {
  reminderId: string;
  reference: string | null;
  type: string;
  bookingDate: string | null;
  bookingTime: string | null;
  action: "sent" | "skipped" | "waiting" | "failed" | "would_send" | "would_skip";
  reason: string;
}

export interface ReminderRunResult {
  success: boolean;
  dryRun: boolean;
  ranAt: string;
  todayWat: string;
  total: number;
  sent: number;
  skipped: number;
  waiting: number;
  failed: number;
  rows: RowOutcome[];
}

export interface RunOptions {
  repo: ReminderRepo;
  /** null when email isn't configured; only allowed for a dry run. */
  send: ((message: EmailMessage) => Promise<EmailResult>) | null;
  siteUrl: string;
  now: number;
  dryRun: boolean;
}

/**
 * One pass over every unsent reminder. Safe to run any number of times a day: a row is claimed
 * (sent_at set where still NULL) BEFORE its email goes out, so an overlapping or repeated run
 * can't send it again; a failed send releases the claim so tomorrow's run re-decides it.
 * A dry run evaluates the same rules but never sends and never writes.
 */
export async function runReminders({ repo, send, siteUrl, now, dryRun }: RunOptions): Promise<ReminderRunResult> {
  const ranAt = new Date(now).toISOString();
  const rows = await repo.fetchUnsent();
  const settings = await repo.settings();
  const outcomes: RowOutcome[] = [];
  // Two unsent rows for the same booking + type (e.g. a booking confirmed twice) must still
  // produce only one email per run.
  const handledThisRun = new Set<string>();

  for (const row of rows) {
    const b = row.booking;
    const base = {
      reminderId: row.id,
      reference: b ? shortBookingReference(b.id) : null,
      type: row.reminder_type,
      bookingDate: b?.booking_date ?? null,
      bookingTime: b?.booking_time ?? null,
    };
    try {
      outcomes.push(await processRowFor(row, b, base));
    } catch (err) {
      // One bad row (e.g. a transient database error) mustn't stop the others. Its claim, if
      // any, stays — so it is never sent twice; worst case it's reported here and not retried.
      console.error("process-reminders: row failed", row.id, err);
      outcomes.push({ ...base, action: "failed", reason: "database error while processing this reminder" });
    }
  }

  async function processRowFor(row: UnsentReminder, b: ReminderBookingRow | null, base: Omit<RowOutcome, "action" | "reason">): Promise<RowOutcome> {
    let decision = decideReminder(row.reminder_type, b, now);
    const dedupeKey = `${row.booking_id}:${row.reminder_type}`;
    if (decision.action === "send" && handledThisRun.has(dedupeKey)) {
      decision = { action: "skip", reason: "duplicate reminder row for the same booking, already handled this run" };
    }

    if (decision.action === "wait") return { ...base, action: "waiting", reason: decision.reason };
    if (dryRun) {
      if (decision.action === "send") handledThisRun.add(dedupeKey);
      return { ...base, action: decision.action === "send" ? "would_send" : "would_skip", reason: decision.reason };
    }

    if (decision.action === "skip") {
      const won = await repo.claim(row.id, ranAt);
      return { ...base, action: "skipped", reason: won ? decision.reason : "already handled by another run" };
    }

    // send
    handledThisRun.add(dedupeKey);
    if (!send) return { ...base, action: "failed", reason: "email is not configured" };
    // Everything that could throw happens before the claim; after it, only the (non-throwing)
    // send and the release on failure — so a claimed row is either sent or released.
    const names = b!.service_ids.length ? await repo.serviceNames(b!.service_ids) : [];
    const message = renderReminderEmail(row.reminder_type as ReminderType, b!, { siteUrl, ...settings, serviceNames: names });
    if (!(await repo.claim(row.id, ranAt))) return { ...base, action: "skipped", reason: "already handled by another run" };
    const result = await send(message);
    if (result.ok) return { ...base, action: "sent", reason: decision.reason };
    await repo.release(row.id, ranAt);
    return { ...base, action: "failed", reason: result.error };
  }

  const count = (...actions: RowOutcome["action"][]) => outcomes.filter(o => actions.includes(o.action)).length;
  return {
    success: count("failed") === 0,
    dryRun,
    ranAt,
    todayWat: watDateOf(now),
    total: rows.length,
    sent: count("sent", "would_send"),
    skipped: count("skipped", "would_skip"),
    waiting: count("waiting"),
    failed: count("failed"),
    rows: outcomes,
  };
}

// ─── Email ─────────────────────────────────────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const DEFAULT_LOCATION_URL = "https://www.google.com/maps/search/?api=1&query=Lagos,Nigeria";

export function renderReminderEmail(
  type: ReminderType,
  booking: ReminderBookingRow,
  ctx: { siteUrl: string; phone: string | null; locationUrl: string | null; serviceNames: string[] },
): EmailMessage {
  const dayBefore = type === "24h_before";
  const reference = shortBookingReference(booking.id);
  const date = formatLongDate(booking.booking_date);
  const time = escapeHtml(booking.booking_time);
  const services = ctx.serviceNames.length ? ctx.serviceNames.map(escapeHtml).join(", ") : "Custom style";
  const whatsapp = buildWhatsAppUrl(ctx.phone ?? undefined, `Hi Nessy, about my booking ${reference} on ${date} at ${booking.booking_time}.`);
  const locationUrl = ctx.locationUrl && /^https:\/\//.test(ctx.locationUrl) ? ctx.locationUrl : DEFAULT_LOCATION_URL;
  return {
    to: booking.client_email!,
    subject: dayBefore ? "Reminder: your Nessy Hairlon appointment is tomorrow" : "Reminder: your Nessy Hairlon appointment is today",
    html: `
    <h2>${dayBefore ? "See you tomorrow!" : `See you today at ${time}!`}</h2>
    <p>Date: <strong>${date}</strong></p>
    <p>Time: <strong>${time}</strong></p>
    <p>Service: <strong>${services}</strong></p>
    <p>Location: <a href="${escapeHtml(locationUrl)}" style="color:#C49A6C">Lagos, Nigeria</a></p>
    <p style="margin-top:16px;font-size:13px;color:#666;">
      Need to change anything? <a href="${whatsapp}" style="color:#C49A6C">Message Nessy on WhatsApp</a>
    </p>
    <p style="font-size:13px;"><a href="${ctx.siteUrl}/track" style="color:#C49A6C">View your booking</a></p>
  `,
  };
}

// ─── Production wiring ─────────────────────────────────────────────────────────────────────

export function supabaseReminderRepo(db: SupabaseClient<Database>): ReminderRepo {
  return {
    async fetchUnsent() {
      const { data, error } = await db.from("booking_reminders")
        .select("id, booking_id, reminder_type, bookings(id, client_name, client_email, booking_date, booking_time, status, service_ids)")
        .is("sent_at", null)
        .order("scheduled_for", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(r => {
        const row = r as unknown as { id: string; booking_id: string | null; reminder_type: string; bookings: ReminderBookingRow | ReminderBookingRow[] | null };
        const booking = Array.isArray(row.bookings) ? row.bookings[0] ?? null : row.bookings;
        return { id: row.id, booking_id: row.booking_id, reminder_type: row.reminder_type, booking };
      });
    },
    async claim(id, at) {
      const { data, error } = await db.from("booking_reminders").update({ sent_at: at }).eq("id", id).is("sent_at", null).select("id");
      if (error) throw error;
      return (data ?? []).length === 1;
    },
    async release(id, at) {
      const { error } = await db.from("booking_reminders").update({ sent_at: null }).eq("id", id).eq("sent_at", at);
      if (error) console.error("process-reminders: failed to release claim", id, error);
    },
    async serviceNames(ids) {
      const { data } = await db.from("services").select("id, name").in("id", ids);
      return (data ?? []).map(s => s.name);
    },
    async settings() {
      const { data } = await db.from("settings").select("key, value").in("key", ["phone", "location_url"]);
      const map = Object.fromEntries((data ?? []).map(r => [r.key, r.value]));
      return {
        phone: typeof map.phone === "string" ? map.phone : null,
        locationUrl: typeof map.location_url === "string" ? map.location_url : null,
      };
    },
  };
}
