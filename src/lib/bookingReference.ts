/**
 * Derives a short, human-friendly reference code from a booking's uuid — the
 * first 8 hex characters, uppercased, prefixed "BK-". Not stored; computed the
 * same way here and in supabase/migrations/003_booking_lookup.sql so a client
 * can always look their booking back up by this code alone.
 */
export function shortBookingReference(id: string): string {
  return `BK-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}
