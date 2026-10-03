-- Migration: Add attachment/accessory support to bookings

-- 1. Add new columns to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS attachment_preference TEXT CHECK (attachment_preference IN ('client_provides', 'nessy_buys')),
  ADD COLUMN IF NOT EXISTS attachment_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS accessory_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hair_service_cost NUMERIC;

-- 2. Update lookup_bookings to also return the new columns.
--
-- Postgres can't CREATE OR REPLACE a function that changes its RETURNS TABLE
-- shape, so the existing function (003_booking_lookup.sql) must be dropped
-- first. Everything else below — exact reference/phone match, ordering,
-- limit, language/volatility — is copied from the live function as-is; only
-- the new attachment/accessory/hair-service columns are added.
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
  hair_service_cost numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select b.id, b.client_name, b.booking_date, b.booking_time, b.status, b.quoted_price,
         b.service_ids, b.custom_style_url, b.custom_style_description, b.created_at,
         b.attachment_preference, b.attachment_items, b.accessory_items, b.hair_service_cost
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
