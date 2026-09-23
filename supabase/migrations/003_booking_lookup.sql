-- Client-facing "track my booking" lookup.
--
-- bookings.SELECT is authenticated-only (see 002_fix_rls_policies.sql — the table
-- holds client PII). Rather than reopening that, expose a narrow SECURITY DEFINER
-- function: it always requires an exact match on a booking's short reference code
-- or the client's own phone number, and returns only the columns needed to show
-- status — never a table scan, never all bookings.
--
-- The reference code is derived, not stored: "BK-" + the first 8 hex chars of the
-- id, uppercased (see src/lib/bookingReference.ts for the client-side mirror).

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
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select b.id, b.client_name, b.booking_date, b.booking_time, b.status, b.quoted_price,
         b.service_ids, b.custom_style_url, b.custom_style_description, b.created_at
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
