-- Optional free-text note a client can attach at booking time (e.g. "I'd also like a
-- style done after my treatment") so Nessy can quote treatments and styles together.
-- Distinct from the existing `notes` column, which the anon INSERT policy
-- (014_harden_booking_insert.sql) already requires to be null at creation — that one is
-- admin-only. client_notes is legitimately client-provided, same as custom_style_url/
-- style_reference_urls, so (as with those) no RLS policy change is needed: the anon
-- INSERT policy's WITH CHECK doesn't reference this column, and the authenticated
-- policy is unconditional.
alter table bookings
  add column if not exists client_notes text,
  add constraint client_notes_max_length check (char_length(client_notes) <= 500);
