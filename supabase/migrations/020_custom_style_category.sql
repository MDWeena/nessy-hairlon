-- Records which service category a custom-style booking (photo/link upload, no matching menu
-- item) was classified under when admin set its price — lets the quote be checked against that
-- category's cheapest published service instead of being priced arbitrarily.
--
-- This schema has no separate service_categories table — `services.category` is a plain text
-- column (see 001_initial_schema.sql), not a foreign key — so this mirrors that: a nullable
-- text column, not an FK. No RLS policy change needed: it's set by the admin's existing
-- quoting flow (authenticated, already covered by the unconditional bookings_all_authenticated
-- policy), never by the anon client.
alter table bookings
  add column if not exists custom_style_category text;
