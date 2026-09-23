-- Verified client reviews: a testimonial can now be linked back to the
-- completed booking it came from and flagged as client-submitted (vs.
-- admin-typed). Client-submitted reviews default to hidden until an admin
-- approves them.

alter table testimonials add column if not exists review_date date not null default current_date;
alter table testimonials add column if not exists booking_id uuid references bookings(id) default null;
alter table testimonials add column if not exists is_verified boolean not null default false;

update testimonials set review_date = created_at::date where review_date is null;

-- Client-facing "leave a review" submission — no auth (same pattern as
-- lookup_bookings/reschedule_booking/cancel_booking): exact reference + phone
-- match required, booking must be completed, one review per booking. Runs as
-- SECURITY DEFINER so it can insert into testimonials without opening a broad
-- anon INSERT policy on the table (which would let anyone post fake reviews
-- with arbitrary is_visible/is_verified values).
create or replace function public.submit_review(
  p_reference text,
  p_phone text,
  p_stars integer,
  p_review_text text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings%rowtype;
  v_id uuid;
begin
  if p_stars is null or p_stars < 1 or p_stars > 5 then
    raise exception 'Please choose a star rating between 1 and 5';
  end if;
  if p_review_text is null or length(trim(p_review_text)) = 0 then
    raise exception 'Please write a short review';
  end if;

  select * into v_booking
  from bookings b
  where p_reference is not null and p_reference <> ''
    and left(upper(replace(b.id::text, '-', '')), 8) = upper(regexp_replace(p_reference, '^BK-?', ''))
    and p_phone is not null and b.client_phone = p_phone
  limit 1;

  if not found then
    raise exception 'We could not find that booking. Check your reference and phone number.';
  end if;

  if v_booking.status <> 'completed' then
    raise exception 'Only completed appointments can be reviewed';
  end if;

  if exists (select 1 from testimonials where booking_id = v_booking.id) then
    raise exception 'This appointment has already been reviewed';
  end if;

  insert into testimonials (client_name, review_text, stars, is_visible, is_verified, booking_id, review_date)
  values (v_booking.client_name, trim(p_review_text), p_stars, false, true, v_booking.id, current_date)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_review(text, text, integer, text) from public;
grant execute on function public.submit_review(text, text, integer, text) to anon, authenticated;
