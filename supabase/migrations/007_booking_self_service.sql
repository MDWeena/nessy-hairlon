-- Client self-service reschedule/cancel from the Track Booking page — no
-- auth (client never signs in anywhere). Same verification pattern as
-- lookup_bookings: exact reference + phone match required on the SAME row,
-- and each function can only touch the columns it's named for (no price
-- manipulation, no status escalation beyond 'cancelled').

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
  v_appointment timestamp;
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
  v_appointment := v_booking.booking_date + (v_hour * interval '1 hour');

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

create or replace function public.cancel_booking(
  p_reference text,
  p_phone text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings%rowtype;
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

  if v_booking.status in ('completed', 'cancelled') then
    raise exception 'This booking cannot be cancelled';
  end if;

  update bookings set status = 'cancelled', updated_at = now() where id = v_booking.id;
end;
$$;

revoke all on function public.cancel_booking(text, text) from public;
grant execute on function public.cancel_booking(text, text) to anon, authenticated;
