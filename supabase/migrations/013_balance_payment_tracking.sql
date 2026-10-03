-- Balance (remaining-payment) tracking, separate from the existing deposit tracking.

alter table bookings
  add column if not exists balance_paid_at timestamptz,
  add column if not exists balance_reminder_sent_at timestamptz;

-- Update lookup_bookings to also return the new columns.
--
-- Postgres can't CREATE OR REPLACE a function that changes its RETURNS TABLE
-- shape, so the existing function (003_booking_lookup.sql, last extended by
-- 012_attachment_fields.sql) must be dropped first. The live definition was
-- read directly via `select pg_get_functiondef(oid) from pg_proc where
-- proname = 'lookup_bookings'` before writing this migration — everything
-- below (exact reference/phone match, ordering, limit, language/volatility,
-- grants) is copied from it as-is; only the two new columns are added.
drop function if exists public.lookup_bookings(text, text);

create or replace function public.lookup_bookings(p_reference text default null, p_phone text default null)
returns table (
  id uuid,
  client_name text,
  booking_date date,
  booking_time text,
  status text,
  quoted_price integer,
  service_ids uuid[],
  custom_style_url text,
  custom_style_description text,
  created_at timestamptz,
  attachment_preference text,
  attachment_items jsonb,
  accessory_items jsonb,
  hair_service_cost numeric,
  balance_paid_at timestamptz,
  balance_reminder_sent_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select b.id, b.client_name, b.booking_date, b.booking_time, b.status, b.quoted_price,
         b.service_ids, b.custom_style_url, b.custom_style_description, b.created_at,
         b.attachment_preference, b.attachment_items, b.accessory_items, b.hair_service_cost,
         b.balance_paid_at, b.balance_reminder_sent_at
  from bookings b
  where (
    p_reference is not null and p_reference <> ''
    and left(upper(replace(b.id::text, '-', '')), 8) = upper(regexp_replace(p_reference, '^BK-?', ''))
  )
  or (
    p_phone is not null and p_phone <> '' and b.client_phone = p_phone
  )
  order by b.created_at desc
  limit 10;
$$;

revoke all on function public.lookup_bookings(text, text) from public;
grant execute on function public.lookup_bookings(text, text) to anon, authenticated;
