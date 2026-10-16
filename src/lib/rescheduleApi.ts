import { supabase } from "./supabase";
import { RESCHEDULE_ERROR_MESSAGES, isRescheduleErrorCode, type RescheduleEligibility, type RescheduleErrorCode } from "./reschedule";
import type { OrderStatus } from "../types";

export class RescheduleRequestError extends Error {
  readonly code: RescheduleErrorCode;
  readonly remaining: number | null;
  constructor(code: RescheduleErrorCode, message: string, remaining: number | null) {
    super(message);
    this.code = code;
    this.remaining = remaining;
  }
}

async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new RescheduleRequestError("SERVER_ERROR", "Couldn't reach the server. Check your connection and try again.", null);
  }
  const json = await res.json().catch(() => null) as (Record<string, unknown> & { ok?: boolean }) | null;
  if (!res.ok || !json?.ok) {
    const code = isRescheduleErrorCode(json?.code) ? json.code : "SERVER_ERROR";
    const message = typeof json?.message === "string" ? json.message : RESCHEDULE_ERROR_MESSAGES[code];
    const remaining = typeof json?.remaining === "number" ? json.remaining : null;
    throw new RescheduleRequestError(code, message, remaining);
  }
  return json as T;
}

export interface ClientProof {
  phone?: string;
  email?: string;
}

/** One "phone or email" field → the right proof field for the API. */
export function contactProof(raw: string): ClientProof {
  const value = raw.trim();
  return value.includes("@") ? { email: value } : { phone: value };
}

export interface EligibilityResponse {
  eligibility: RescheduleEligibility;
  noticeHours: number;
  booking: { reference: string; date: string; time: string; status: OrderStatus };
}

export function checkClientReschedule(reference: string, proof: ClientProof): Promise<EligibilityResponse> {
  return post("/api/reschedule-client", { action: "check", reference, ...proof });
}

export interface ClientRescheduleResponse {
  booking: { reference: string; date: string; time: string; status: OrderStatus };
  previous: { date: string; time: string };
  remaining: number;
  notifications: { clientEmail: string };
}

export function rescheduleAsClient(reference: string, proof: ClientProof, newDate: string, newTime: string): Promise<ClientRescheduleResponse> {
  return post("/api/reschedule-client", { action: "reschedule", reference, ...proof, newDate, newTime });
}

export interface ClientCancelResponse {
  booking: { reference: string; date: string; time: string; status: "cancelled" };
  notifications: { clientEmail: string };
}

/** Same reference + phone-or-email proof as rescheduling; see api/cancel-client.ts. */
export function cancelAsClient(reference: string, proof: ClientProof): Promise<ClientCancelResponse> {
  return post("/api/cancel-client", { reference, ...proof });
}

export interface AdminRescheduleResponse {
  booking: { id: string; date: string; time: string };
  previous: { date: string; time: string };
  reason: string | null;
  hasClientEmail: boolean;
  notifications: {
    clientEmail: "sent" | "failed" | "no_email" | "not_configured";
    adminEmail: "sent" | "failed" | "no_email" | "not_configured";
    whatsappUrl: string | null;
  };
}

export async function rescheduleAsAdmin(bookingId: string, newDate: string, newTime: string, reason: string | null): Promise<AdminRescheduleResponse> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new RescheduleRequestError("UNAUTHORIZED", RESCHEDULE_ERROR_MESSAGES.UNAUTHORIZED, null);
  return post("/api/reschedule-admin", { bookingId, newDate, newTime, reason }, token);
}
