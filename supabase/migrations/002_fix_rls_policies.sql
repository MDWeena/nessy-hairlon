-- Fix RLS gap: bookings contain client PII (name, phone, email) and must not
-- be readable by anon. Only INSERT stays open to anon (clients submitting a
-- booking); SELECT/UPDATE/DELETE already require an authenticated session via
-- the existing "bookings_all_authenticated" policy (for all to authenticated).
--
-- Note: the other tables' "..._all_authenticated" policies use `to authenticated`
-- rather than `using (auth.role() = 'authenticated')` — these are equivalent in
-- effect (Supabase/PostgREST maps the JWT's role claim directly onto the
-- Postgres role the policy is scoped `to`), but resolve without evaluating the
-- USING clause for non-matching roles, so they're left as-is.

drop policy if exists "bookings_select_anon" on bookings;

-- The client-facing booking flow still needs to know which slots are already
-- taken so it doesn't let someone double-book. Expose only the non-PII columns
-- needed for that via a view; views run with the privileges of their owner
-- (not the querying role), so this safely bypasses the bookings table's RLS
-- for just these three columns without exposing client_name/phone/email.
create or replace view public_booking_slots as
  select booking_date, booking_time, status
  from bookings
  where status <> 'cancelled';

grant select on public_booking_slots to anon, authenticated;
