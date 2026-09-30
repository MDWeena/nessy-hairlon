-- Introduces an explicit "deposit_paid" state between "quoted" and
-- "confirmed": a client claiming they've transferred the deposit does not
-- itself confirm the appointment — an admin still has to verify it. This
-- closes the gap where the client-facing UI previously implied a booking was
-- confirmed the moment it was submitted, with no admin review and no deposit
-- ever collected.
--
-- (Numbered 008, not 007 — 007_booking_self_service.sql already exists.)

alter table bookings drop constraint if exists bookings_status_check;
alter table bookings add constraint valid_status
  check (status in ('pending_review', 'quoted', 'deposit_paid', 'confirmed', 'completed', 'cancelled'));

alter table bookings add column if not exists deposit_confirmed_at timestamptz default null;
alter table bookings add column if not exists payment_proof_url text default null;

-- Client-facing "I've paid my deposit" action from the Track Booking page —
-- no auth (client never signs in anywhere). Same verification pattern as
-- reschedule_booking/cancel_booking: exact reference + phone match required
-- on the SAME row. Only allowed from 'quoted', and only moves the booking to
-- 'deposit_paid' — an admin still has to confirm it via Orders.tsx before any
-- reminder gets scheduled or the appointment counts as booked.
create or replace function public.mark_deposit_paid(
  p_reference text,
  p_phone text,
  p_payment_proof_url text default null
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

  if v_booking.status <> 'quoted' then
    raise exception 'This booking is not awaiting a deposit';
  end if;

  update bookings
  set status = 'deposit_paid',
      payment_proof_url = coalesce(p_payment_proof_url, payment_proof_url),
      updated_at = now()
  where id = v_booking.id;
end;
$$;

revoke all on function public.mark_deposit_paid(text, text, text) from public;
grant execute on function public.mark_deposit_paid(text, text, text) to anon, authenticated;
