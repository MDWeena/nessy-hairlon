import type { Resend } from "resend";

export const DEFAULT_FROM_ADDRESS = "Nessy Hairlon <onboarding@resend.dev>";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export type EmailResult = { ok: true; id: string | null } | { ok: false; error: string };

/** Just the part of the Resend client this needs, so tests can pass a fake. */
export type EmailClient = { emails: Pick<Resend["emails"], "send"> };

/**
 * Sends one email and reports what actually happened. Resend's send() RESOLVES with
 * `{ data: null, error }` on API failures (bad key, unverified sender, invalid recipient,
 * rate limit) instead of throwing — code that only wraps it in try/catch reports every one of
 * those as "sent". This checks `error`, catches network-level throws too, and logs failures
 * with `label` so they show up in the Vercel function logs.
 */
export async function sendEmailChecked(client: EmailClient, from: string, message: EmailMessage, label: string): Promise<EmailResult> {
  try {
    const { data, error } = await client.emails.send({ from, to: message.to, subject: message.subject, html: message.html });
    if (error) {
      const description = `${error.name}: ${error.message}`;
      console.error(`${label}: email rejected by Resend —`, description);
      return { ok: false, error: description };
    }
    return { ok: true, id: data?.id ?? null };
  } catch (err) {
    const description = err instanceof Error ? err.message : String(err);
    console.error(`${label}: email send threw —`, description);
    return { ok: false, error: description };
  }
}
