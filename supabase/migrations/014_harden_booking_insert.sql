-- SECURITY FIX (pre-launch audit): the anon INSERT policy on `bookings` was
-- `with check (true)` — it let the client app create a new booking row, but
-- placed no constraint on the row's CONTENTS. The anon key is public (any
-- browser can read it out of the deployed JS bundle), and PostgREST exposes
-- `bookings` directly over HTTP at <project>/rest/v1/bookings. Nothing at the
-- database level stopped a request crafted outside the app's own UI from
-- inserting a booking with status='confirmed' (skipping admin review and
-- deposit collection entirely) or an arbitrary quoted_price/payment/balance
-- field — the app's own client code (src/hooks/useBookings.ts createBooking)
-- never sends those columns and relies on their defaults, but RLS was not
-- actually enforcing that; it was only ever true by client-code convention.
--
-- This replaces the policy with the same `for insert to anon` grant, but adds
-- a WITH CHECK that only allows a row shaped exactly like what createBooking
-- legitimately sends: a brand-new, unreviewed booking with every
-- admin/payment-controlled field left at its safe default. Every field
-- referenced below is one createBooking already never sets, so this changes
-- no legitimate behavior — see src/hooks/useBookings.ts:379-392.

drop policy if exists "bookings_insert_anon" on bookings;

create policy "bookings_insert_anon" on bookings
  for insert to anon
  with check (
    status = 'pending_review'
    and quoted_price is null
    and notes is null
    and hair_service_cost is null
    and deposit_confirmed_at is null
    and payment_proof_url is null
    and balance_paid_at is null
    and balance_reminder_sent_at is null
    and attachment_items = '[]'::jsonb
    and accessory_items = '[]'::jsonb
  );
