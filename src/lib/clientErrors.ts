/**
 * Turns anything thrown in a client-facing flow (booking, Track, reschedule, cancel, review) into
 * a message that's safe to show. Raw database / API text never reaches the page — it's logged to
 * the console instead, so it's still there when debugging.
 *
 * "refresh_needed" covers what an out-of-date copy of the site runs into once the backend has
 * moved on: a permission / row-level-security refusal (Postgres 42501, HTTP 401/403, an expired
 * or rejected JWT) or a call to a database function that no longer exists (PGRST202 / 42883).
 * Reloading picks up the current build, which uses the current paths.
 */
export type ClientErrorKind = "refresh_needed" | "slot_taken" | "network" | "invalid_input" | "unknown";

export interface ClientError {
  kind: ClientErrorKind;
  message: string;
}

export type ErrorContext = "booking" | "track";

export const REFRESH_MESSAGES: Record<ErrorContext, string> = {
  booking: "This page needs a quick refresh to finish your booking. Your details are saved.",
  track: "This page needs a quick refresh to continue. Your details are saved.",
};
export const SLOT_TAKEN_MESSAGE = "That time slot was just booked by someone else. Please pick another.";
export const NETWORK_MESSAGE = "We couldn't reach the server. Check your connection and try again.";
export const GENERIC_MESSAGE = "Something went wrong. Please try again.";

/** An error whose message was written for clients and can be shown as-is. */
export class FriendlyError extends Error {
  readonly kind: ClientErrorKind;
  constructor(message: string, kind: ClientErrorKind = "invalid_input") {
    super(message);
    this.name = "FriendlyError";
    this.kind = kind;
  }
}

interface ErrorLike {
  name?: unknown;
  code?: unknown;
  message?: unknown;
  status?: unknown;
  details?: unknown;
  hint?: unknown;
}

const REFRESH_CODES = new Set(["42501", "PGRST301", "PGRST302", "PGRST202", "42883"]);

function fields(err: unknown): { code: string; message: string; status: number | null; name: string } {
  const e = (err && typeof err === "object" ? err : {}) as ErrorLike;
  return {
    code: typeof e.code === "string" ? e.code : "",
    message: typeof e.message === "string" ? e.message : typeof err === "string" ? err : "",
    status: typeof e.status === "number" ? e.status : null,
    name: typeof e.name === "string" ? e.name : "",
  };
}

export function toClientError(err: unknown, context: ErrorContext = "booking"): ClientError {
  if (err instanceof FriendlyError) return { kind: err.kind, message: err.message };
  const { code, message, status, name } = fields(err);

  let result: ClientError;
  if (
    REFRESH_CODES.has(code) || status === 401 || status === 403
    || /row-level security|permission denied|could not find the function|function .* does not exist|jwt/i.test(message)
  ) {
    result = { kind: "refresh_needed", message: REFRESH_MESSAGES[context] };
  } else if (code === "23505" || code === "SLOT_UNAVAILABLE" || message === "SLOT_UNAVAILABLE") {
    result = { kind: "slot_taken", message: SLOT_TAKEN_MESSAGE };
  } else if (code === "23514") {
    result = { kind: "invalid_input", message: "One of your style links isn't from a supported site (Instagram, Pinterest, TikTok, YouTube, X or Facebook)." };
  } else if (code === "P0001" && /^[A-Z][a-z]/.test(message) && message.length <= 200) {
    // Our own database functions raise sentences written for clients ("This appointment has
    // already been reviewed", "We could not find that booking…"). Codes like SLOT_UNAVAILABLE
    // are upper-case and handled above or fall through to the generic message.
    result = { kind: "invalid_input", message };
  } else if (
    (name === "TypeError" && /fetch|network|load failed/i.test(message))
    || /failed to fetch|networkerror|network request failed|load failed/i.test(message)
  ) {
    result = { kind: "network", message: NETWORK_MESSAGE };
  } else {
    result = { kind: "unknown", message: GENERIC_MESSAGE };
  }
  // The raw error stays visible to whoever is debugging, never to the client.
  console.error(`[${context}] ${result.kind}:`, err);
  return result;
}
