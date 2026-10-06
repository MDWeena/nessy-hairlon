-- Adds link-based style references (Pinterest/Instagram/TikTok URLs etc.) alongside the
-- existing image upload (custom_style_url). Complementary, not a replacement — both can be
-- set on the same booking. Stored as jsonb (consistent with attachment_items/accessory_items
-- below), capped at 5 entries to match the client UI's limit — enforced here too since the
-- anon INSERT policy's WITH CHECK doesn't reference this column (see below).
alter table bookings
  add column if not exists style_reference_urls jsonb not null default '[]'::jsonb,
  add constraint style_reference_urls_is_array
    check (jsonb_typeof(style_reference_urls) = 'array'),
  add constraint style_reference_urls_max_five
    check (jsonb_array_length(style_reference_urls) <= 5);

-- No RLS policy change needed:
-- * bookings_insert_anon (014_harden_booking_insert.sql)'s WITH CHECK only constrains the
--   admin/payment-controlled columns it explicitly lists; style_reference_urls is legitimately
--   client-provided at creation, same as custom_style_url/custom_style_description, which that
--   policy also leaves unconstrained.
-- * bookings_all_authenticated is `for all to authenticated using (true) with check (true)` —
--   unconditional, so it already covers this new column for admin reads/writes.
