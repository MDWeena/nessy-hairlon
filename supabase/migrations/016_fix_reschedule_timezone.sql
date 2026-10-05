-- BUG FIX (pre-launch audit): reschedule_booking's 24h-notice check compared a naive
-- `timestamp` (no time zone) built from the booking's WAT wall-clock date/hour against
-- `now()` (timestamptz). Postgres casts a naive timestamp to timestamptz using the
-- database session's timezone — Supabase databases default to UTC, not WAT (UTC+1) —
-- so a booking's local Lagos time was being evaluated as if it were UTC, shifting the
-- 24-hour cutoff by an hour. This is the same function this migration touches as
-- 007_booking_self_service.sql; everything else (the exact reference+phone match, the
-- status check, the update) is unchanged — only the appointment-instant calculation
-- gains an explicit `at time zone 'Africa/Lagos'` so the comparison to now() is correct
-- regardless of the database session's own timezone setting.
--
-- NOT touching lookup_bookings, cancel_booking, or mark_deposit_paid — none of those
-- do a time-based comparison, so they aren't affected by this bug.

create or replace function public.reschedule_booking(
  p_reference text,
  p_phone text,
  p_new_date date,
  p_new_time text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings%rowtype;
  v_hour integer;
  v_meridiem text;
  v_appointment timestamptz;
begin
  select * into v_booking
  from bookings b
  where p_reference is not null and p_reference <> ''
    and left(upper(replace(b.id::text, '-', '')), 8) = upper(regexp_replace(p_reference, '^BK-?', ''))
    and p_phone is not null and b.client_phone = p_phone
  limit 1;

  if not found then
    raise exception 'We could not find that booking. Check your reference and phone number.';
  end if;

  if v_booking.status not in ('quoted', 'confirmed') then
    raise exception 'This booking cannot be rescheduled';
  end if;

  v_hour := (regexp_match(v_booking.booking_time, '^(\d{1,2}):00\s(AM|PM)$'))[1]::integer;
  v_meridiem := (regexp_match(v_booking.booking_time, '^(\d{1,2}):00\s(AM|PM)$'))[2];
  if v_meridiem = 'PM' and v_hour <> 12 then v_hour := v_hour + 12; end if;
  if v_meridiem = 'AM' and v_hour = 12 then v_hour := 0; end if;
  v_appointment := (v_booking.booking_date + (v_hour * interval '1 hour')) at time zone 'Africa/Lagos';

  if v_appointment < (now() + interval '24 hours') then
    raise exception 'This appointment is too soon to reschedule online. Please call or WhatsApp Nessy directly.';
  end if;

  update bookings
  set booking_date = p_new_date, booking_time = p_new_time, updated_at = now()
  where id = v_booking.id;
end;
$$;

revoke all on function public.reschedule_booking(text, text, date, text) from public;
grant execute on function public.reschedule_booking(text, text, date, text) to anon, authenticated;
