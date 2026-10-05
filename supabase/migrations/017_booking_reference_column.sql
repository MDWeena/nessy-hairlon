-- Admin Orders search (by booking reference/id) needs to ilike-match against the booking's
-- reference fragment server-side, but `bookings.id` is a uuid column — Postgres has no ilike
-- operator for uuid, and PostgREST's filter grammar (including inside .or() logic trees) has
-- no syntax to cast a column in the request itself. A generated, stored text column sidesteps
-- this cleanly: it's always in sync with id (Postgres maintains it, not application code), and
-- is a plain text column any ilike search can match against directly.
--
-- Same derivation as src/lib/bookingReference.ts / supabase/migrations/003_booking_lookup.sql's
-- lookup_bookings (not modified by this migration): the first 8 hex chars of the id, uppercased.
-- Stored bare (no "BK-" prefix) — the search-building code strips that prefix from the user's
-- input before matching, same as lookup_bookings already does for the reference parameter.

alter table bookings
  add column if not exists reference_code text
  generated always as (upper(substring(replace(id::text, '-', ''), 1, 8))) stored;

create index if not exists bookings_reference_code_idx on bookings (reference_code);
