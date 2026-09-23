import { supabase } from "./supabase";

const AUTH_ERROR_CODES = new Set(["42501", "PGRST301", "PGRST302"]);

interface PossibleAuthError {
  code?: string;
  message?: string;
}

/**
 * Throws if there is no valid Supabase session. Call at the top of every
 * admin write (INSERT/UPDATE/DELETE) so a stale/expired session fails fast
 * with a clear message instead of attempting a doomed request.
 */
export async function assertAuthenticated(): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    await supabase.auth.signOut();
    throw new Error("Your session has expired. Please sign in again.");
  }
}

/**
 * Call when a write fails. If the failure looks auth-related (RLS denial or
 * an invalid/expired JWT), force a sign-out so the UI reactively redirects to
 * login; otherwise surface the underlying message. Always throws.
 */
export async function handleWriteError(error: PossibleAuthError): Promise<never> {
  const isAuthError = AUTH_ERROR_CODES.has(error.code ?? "") || /jwt/i.test(error.message ?? "");
  if (isAuthError) {
    await supabase.auth.signOut();
    throw new Error("Your session has expired. Please sign in again.");
  }
  throw new Error(error.message ?? "Something went wrong. Please try again.");
}
