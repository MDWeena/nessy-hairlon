import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import type { Database } from "../../src/types/database.js";
import { shortBookingReference } from "../../src/lib/bookingReference.js";
import {
  MAX_CLIENT_RESCHEDULES, RESCHEDULE_ERROR_MESSAGES, cancelErrorMessage, contactMatchesBooking, getRescheduleEligibility,
  isRescheduleErrorCode, normalizeReference, type RescheduleErrorCode,
} from "../../src/lib/reschedule.js";
import {
  sendCancelNotifications, sendRescheduleNotifications, type NotificationOutcome, type SendEmail,
} from "./rescheduleEmails.js";
import { DEFAULT_FROM_ADDRESS, sendEmailChecked } from "./email.js";

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];

export interface RescheduleRpcResult {
  booking_id: string;
  old_date: string;
  old_time: string;
  new_date: string;
  new_time: string;
  rescheduled_by: "client" | "admin";
  reason: string | null;
  client_reschedule_count: number;
  reminders_scheduled: number;
}

export interface CancelRpcResult {
  booking_id: string;
  previous_status: BookingRow["status"];
  date: string;
  time: string;
}

export class RescheduleError extends Error {
  readonly code: RescheduleErrorCode;
  constructor(code: RescheduleErrorCode) {
    super(code);
    this.code = code;
  }
}

/** Everything the two routes need from the database — an interface so the route logic can
 * be tested without a live Supabase project (the SQL itself is tested against real Postgres
 * in api/_tests/rescheduleBooking.sql.test.ts). */
export interface RescheduleRepo {
  findBookingsByReference(referenceCode: string): Promise<BookingRow[]>;
  getBooking(id: string): Promise<BookingRow | null>;
  getNoticeHours(): Promise<number>;
  getNessyPhone(): Promise<string | null>;
  /** Throws RescheduleError on any rule the SQL function rejects. */
  reschedule(bookingId: string, date: string, time: string, actor: "client" | "admin", reason: string | null): Promise<RescheduleRpcResult>;
  /** Throws RescheduleError (NOT_FOUND / INVALID_STATUS) if cancel_booking_by_id() refuses. */
  cancel(bookingId: string): Promise<CancelRpcResult>;
  /** Records one hit for `bucket` and returns how many it now has inside the window. */
  hitRateLimit(bucket: string, windowMs: number): Promise<number>;
}

export interface RescheduleEnv {
  repo: RescheduleRepo;
  sendEmail: SendEmail | null;
  adminEmail: string | null;
  verifyAdminToken: (token: string) => Promise<boolean>;
  now: () => number;
}

export interface HandlerResult {
  status: number;
  body: Record<string, unknown>;
}

/** Shared by every public client endpoint (reschedule and cancel use one bucket per IP), so
 * guessing references against one endpoint also uses up the allowance on the other. */
export const CLIENT_RATE_LIMIT = { max: 20, windowMs: 15 * 60 * 1000 };
const clientRateLimitBucket = (ip: string) => `client-booking:${ip}`;

const HTTP_STATUS: Record<RescheduleErrorCode, number> = {
  INVALID_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  SLOT_UNAVAILABLE: 409,
  SAME_SLOT: 409,
  TOO_LATE: 422,
  LIMIT_REACHED: 422,
  INVALID_STATUS: 422,
  RATE_LIMITED: 429,
  SERVER_ERROR: 500,
};

/** Maps a Postgres/PostgREST error from reschedule_booking() to a RescheduleError, or null if
 * it's not one of the rule failures (i.e. a genuine server error). */
export function toRescheduleError(err: { code?: string; message?: string } | null | undefined): RescheduleError | null {
  // 23505: the unique (booking_date, booking_time) index — a brand-new booking (which inserts
  // directly, without the per-date advisory lock) took the slot mid-flight.
  if (err?.code === "23505") return new RescheduleError("SLOT_UNAVAILABLE");
  if (isRescheduleErrorCode(err?.message)) return new RescheduleError(err.message);
  return null;
}

export function errorResult(code: RescheduleErrorCode, extra: Record<string, unknown> = {}): HandlerResult {
  return { status: HTTP_STATUS[code], body: { ok: false, code, message: RESCHEDULE_ERROR_MESSAGES[code], ...extra } };
}

function cancelErrorResult(code: RescheduleErrorCode): HandlerResult {
  const result = errorResult(code);
  return { ...result, body: { ...result.body, message: cancelErrorMessage(code) } };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{1,2}:00 (AM|PM)$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REASON_LENGTH = 500;

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function runReschedule(env: RescheduleEnv, booking: BookingRow, date: string, time: string, actor: "client" | "admin", reason: string | null) {
  try {
    return { result: await env.repo.reschedule(booking.id, date, time, actor, reason) };
  } catch (err) {
    if (err instanceof RescheduleError) return { error: err.code };
    console.error("reschedule: unexpected failure", err);
    return { error: "SERVER_ERROR" as const };
  }
}

async function notify(env: RescheduleEnv, actor: "client" | "admin", booking: BookingRow, result: RescheduleRpcResult, siteUrl: string): Promise<NotificationOutcome> {
  const nessyPhone = actor === "admin" ? await env.repo.getNessyPhone().catch(() => null) : null;
  return sendRescheduleNotifications(actor, {
    reference: shortBookingReference(booking.id),
    clientName: booking.client_name,
    clientPhone: booking.client_phone,
    clientEmail: booking.client_email,
    oldDate: result.old_date,
    oldTime: result.old_time,
    newDate: result.new_date,
    newTime: result.new_time,
    reason: result.reason,
    clientRescheduleCount: result.client_reschedule_count,
  }, { siteUrl, adminEmail: env.adminEmail, nessyPhone }, env.sendEmail);
}

/**
 * The shared front half of every public client endpoint: rate limit, then find the booking by
 * reference and check the phone OR email against it. Every mismatch — unknown reference, wrong
 * phone, wrong email — is the same NOT_FOUND, so the endpoints can't be used to discover
 * bookings. The rate limit runs before the lookup so failed guesses count too.
 */
async function verifyClientBooking(
  env: RescheduleEnv, reference: string, proof: { phone: string; email: string }, ip: string, label: string,
): Promise<{ booking: BookingRow } | { error: RescheduleErrorCode }> {
  try {
    const hits = await env.repo.hitRateLimit(clientRateLimitBucket(ip), CLIENT_RATE_LIMIT.windowMs);
    if (hits > CLIENT_RATE_LIMIT.max) return { error: "RATE_LIMITED" };
  } catch (err) {
    // Fail open: a rate-limit bookkeeping hiccup shouldn't lock every client out.
    console.error(`${label}: rate limit check failed`, err);
  }

  if (!/^[0-9A-F]{8}$/.test(reference)) return { error: "NOT_FOUND" };

  try {
    const candidates = await env.repo.findBookingsByReference(reference);
    const booking = candidates.find(b => contactMatchesBooking(proof, b));
    return booking ? { booking } : { error: "NOT_FOUND" };
  } catch (err) {
    console.error(`${label}: lookup failed`, err);
    return { error: "SERVER_ERROR" };
  }
}

/**
 * Public, unauthenticated: the client proves ownership with the booking reference plus the
 * phone OR email on that booking. Every mismatch — unknown reference, wrong phone, wrong
 * email — returns the same NOT_FOUND, so the endpoint can't be used to discover bookings.
 * action "check" reports eligibility without changing anything (the Track page uses it to
 * decide what to show before a slot is picked); "reschedule" does the move.
 */
export async function handleClientReschedule(env: RescheduleEnv, input: unknown, ip: string, siteUrl: string): Promise<HandlerResult> {
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const action = body.action === "check" ? "check" : "reschedule";
  const reference = normalizeReference(asString(body.reference));
  const phone = asString(body.phone);
  const email = asString(body.email);
  const newDate = asString(body.newDate);
  const newTime = asString(body.newTime);

  if (!reference || (!phone && !email)) return errorResult("INVALID_REQUEST");
  if (action === "reschedule" && (!DATE_RE.test(newDate) || !TIME_RE.test(newTime))) return errorResult("INVALID_REQUEST");

  const verified = await verifyClientBooking(env, reference, { phone, email }, ip, "reschedule-client");
  if ("error" in verified) return errorResult(verified.error);
  const { booking } = verified;

  if (action === "check") {
    const noticeHours = await env.repo.getNoticeHours();
    const eligibility = getRescheduleEligibility({
      status: booking.status, date: booking.booking_date, time: booking.booking_time,
      clientRescheduleCount: booking.client_reschedule_count, noticeHours, actor: "client", now: env.now(),
    });
    return {
      status: 200,
      body: {
        ok: true, eligibility, noticeHours,
        booking: { reference: shortBookingReference(booking.id), date: booking.booking_date, time: booking.booking_time, status: booking.status },
      },
    };
  }

  const outcome = await runReschedule(env, booking, newDate, newTime, "client", null);
  if ("error" in outcome && outcome.error) {
    const remaining = Math.max(0, MAX_CLIENT_RESCHEDULES - booking.client_reschedule_count);
    return errorResult(outcome.error, { remaining });
  }
  const result = outcome.result!;
  const notifications = await notify(env, "client", booking, result, siteUrl);
  return {
    status: 200,
    body: {
      ok: true,
      booking: { reference: shortBookingReference(booking.id), date: result.new_date, time: result.new_time, status: booking.status },
      previous: { date: result.old_date, time: result.old_time },
      remaining: Math.max(0, MAX_CLIENT_RESCHEDULES - result.client_reschedule_count),
      notifications: { clientEmail: notifications.clientEmail },
    },
  };
}

/**
 * Public, unauthenticated client cancel — same proof, rate limit and NOT_FOUND-on-mismatch as
 * handleClientReschedule. The status rule (anything but completed/cancelled) lives in
 * cancel_booking_by_id(). Emails go out after the cancel commits and can't undo it.
 */
export async function handleClientCancel(env: RescheduleEnv, input: unknown, ip: string, siteUrl: string): Promise<HandlerResult> {
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const reference = normalizeReference(asString(body.reference));
  const phone = asString(body.phone);
  const email = asString(body.email);
  if (!reference || (!phone && !email)) return cancelErrorResult("INVALID_REQUEST");

  const verified = await verifyClientBooking(env, reference, { phone, email }, ip, "cancel-client");
  if ("error" in verified) return cancelErrorResult(verified.error);
  const { booking } = verified;

  let result: CancelRpcResult;
  try {
    result = await env.repo.cancel(booking.id);
  } catch (err) {
    if (err instanceof RescheduleError) return cancelErrorResult(err.code);
    console.error("cancel-client: unexpected failure", err);
    return cancelErrorResult("SERVER_ERROR");
  }

  const notifications = await sendCancelNotifications({
    reference: shortBookingReference(booking.id),
    bookingId: booking.id,
    clientName: booking.client_name,
    clientPhone: booking.client_phone,
    clientEmail: booking.client_email,
    date: result.date,
    time: result.time,
    previousStatus: result.previous_status,
  }, { siteUrl, adminEmail: env.adminEmail, nessyPhone: null }, env.sendEmail);

  return {
    status: 200,
    body: {
      ok: true,
      booking: { reference: shortBookingReference(booking.id), date: result.date, time: result.time, status: "cancelled" },
      notifications: { clientEmail: notifications.clientEmail },
    },
  };
}

/** Admin-only: same Supabase-JWT check as the other admin routes. No notice window or count
 * limit, but the new slot still has to be genuinely available (enforced in SQL). */
export async function handleAdminReschedule(env: RescheduleEnv, input: unknown, authHeader: string | undefined, siteUrl: string): Promise<HandlerResult> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!token || !(await env.verifyAdminToken(token).catch(() => false))) return errorResult("UNAUTHORIZED");

  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const bookingId = asString(body.bookingId);
  const newDate = asString(body.newDate);
  const newTime = asString(body.newTime);
  const reason = asString(body.reason).slice(0, MAX_REASON_LENGTH) || null;
  if (!UUID_RE.test(bookingId) || !DATE_RE.test(newDate) || !TIME_RE.test(newTime)) return errorResult("INVALID_REQUEST");

  let booking: BookingRow | null;
  try {
    booking = await env.repo.getBooking(bookingId);
  } catch (err) {
    console.error("reschedule-admin: lookup failed", err);
    return errorResult("SERVER_ERROR");
  }
  if (!booking) return errorResult("NOT_FOUND");

  const outcome = await runReschedule(env, booking, newDate, newTime, "admin", reason);
  if ("error" in outcome && outcome.error) return errorResult(outcome.error);
  const result = outcome.result!;
  const notifications = await notify(env, "admin", booking, result, siteUrl);
  return {
    status: 200,
    body: {
      ok: true,
      booking: { id: booking.id, date: result.new_date, time: result.new_time },
      previous: { date: result.old_date, time: result.old_time },
      reason: result.reason,
      hasClientEmail: !!booking.client_email,
      notifications,
    },
  };
}

// ─── Production wiring ─────────────────────────────────────────────────────────────────────

function supabaseRepo(db: SupabaseClient<Database>): RescheduleRepo {
  const settingValue = async (key: string) => {
    const { data, error } = await db.from("settings").select("value").eq("key", key).maybeSingle();
    if (error) throw error;
    return data?.value ?? null;
  };

  return {
    async findBookingsByReference(referenceCode) {
      const { data, error } = await db.from("bookings").select("*").eq("reference_code", referenceCode);
      if (error) throw error;
      return data ?? [];
    },
    async getBooking(id) {
      const { data, error } = await db.from("bookings").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
    async getNoticeHours() {
      // Same fallbacks as useAvailability: unreadable → 24 (err toward more notice), unset → 0.
      try {
        return Number(await settingValue("min_booking_notice_hours") ?? 0) || 0;
      } catch {
        return 24;
      }
    },
    async getNessyPhone() {
      const value = await settingValue("phone");
      return typeof value === "string" ? value : null;
    },
    async reschedule(bookingId, date, time, actor, reason) {
      const { data, error } = await db.rpc("reschedule_booking", {
        p_booking_id: bookingId, p_new_date: date, p_new_time: time, p_actor: actor, p_reason: reason,
      });
      if (error) throw toRescheduleError(error) ?? error;
      return data as unknown as RescheduleRpcResult;
    },
    async cancel(bookingId) {
      const { data, error } = await db.rpc("cancel_booking_by_id", { p_booking_id: bookingId });
      if (error) throw toRescheduleError(error) ?? error;
      return data as unknown as CancelRpcResult;
    },
    async hitRateLimit(bucket, windowMs) {
      const since = new Date(Date.now() - windowMs).toISOString();
      const { error: insertError } = await db.from("api_rate_limit_events").insert({ bucket });
      if (insertError) throw insertError;
      const { count, error } = await db.from("api_rate_limit_events")
        .select("id", { count: "exact", head: true }).eq("bucket", bucket).gte("created_at", since);
      if (error) throw error;
      // Opportunistic cleanup so the table doesn't grow forever; failure here doesn't matter.
      await db.from("api_rate_limit_events").delete().lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      return count ?? 0;
    },
  };
}

/** null when Supabase isn't configured — the routes answer SERVER_ERROR in that case. */
export function productionEnv(): RescheduleEnv | null {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  const db = createClient<Database>(supabaseUrl, serviceRoleKey);

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_ADDRESS;
  const resend = resendApiKey ? new Resend(resendApiKey) : null;
  const sendEmail: SendEmail | null = resend
    ? async (email) => {
        const result = await sendEmailChecked(resend, fromAddress, email, `booking email to ${email.to}`);
        if (!result.ok) throw new Error(result.error);
      }
    : null;

  return {
    repo: supabaseRepo(db),
    sendEmail,
    adminEmail: process.env.ADMIN_NOTIFICATION_EMAIL || null,
    verifyAdminToken: async (token) => {
      const { data, error } = await db.auth.getUser(token);
      return !error && !!data.user;
    },
    now: () => Date.now(),
  };
}

export function clientIp(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  const realIp = headers["x-real-ip"];
  return first || (Array.isArray(realIp) ? realIp[0] : realIp) || "unknown";
}
