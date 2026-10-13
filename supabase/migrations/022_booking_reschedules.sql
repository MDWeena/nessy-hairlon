-- Booking rescheduling for clients (Track Booking page) and the admin.
--
-- Replaces the client-only reschedule_booking(text, text, date, text) from
-- 007_booking_self_service.sql / 016_fix_reschedule_timezone.sql. That function was granted
-- to anon and did no availability check at all — any date/time was accepted, so a client
-- (or anyone holding a reference + phone, straight against the REST API) could move a
-- booking onto a closed day, a blocked day, past the day's capacity or inside another
-- booking's minimum gap. It also never touched booking_reminders, so reminders kept firing
-- for the old time. It is dropped below; the new function is reachable only by service_role,
-- from api/reschedule-client.ts and api/reschedule-admin.ts.
--
-- DEPLOY ORDER: the currently-deployed frontend calls the old function from the browser, so
-- applying this migration breaks the old Track Booking reschedule button until the new
-- frontend (which calls the API routes instead) is deployed. Apply it together with that
-- deploy.

-- ─── Columns on bookings ───────────────────────────────────────────────────────────────────
alter table bookings
  add column if not exists client_reschedule_count integer not null default 0,
  add column if not exists last_rescheduled_at timestamptz;

alter table bookings drop constraint if exists client_reschedule_count_non_negative;
alter table bookings add constraint client_reschedule_count_non_negative check (client_reschedule_count >= 0);

-- The anon INSERT policy (014_harden_booking_insert.sql) only allows a brand-new row with
-- every admin/system-controlled column at its default. The new columns are system-controlled
-- too — without this, a client could insert a booking with client_reschedule_count = -100 and
-- get unlimited online reschedules. custom_style_category (020) is admin-set and was missed
-- when that column was added; it's covered here as well since the policy is being recreated.
drop policy if exists "bookings_insert_anon" on bookings;
create policy "bookings_insert_anon" on bookings
  for insert to anon
  with check (
    status = 'pending_review'
    and quoted_price is null
    and notes is null
    and hair_service_cost is null
    and deposit_confirmed_at is null
    and payment_proof_url is null
    and balance_paid_at is null
    and balance_reminder_sent_at is null
    and attachment_items = '[]'::jsonb
    and accessory_items = '[]'::jsonb
    and custom_style_category is null
    and client_reschedule_count = 0
    and last_rescheduled_at is null
  );

-- ─── Audit trail ───────────────────────────────────────────────────────────────────────────
create table if not exists booking_reschedules (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  old_date date not null,
  old_start_time text not null,
  new_date date not null,
  new_start_time text not null,
  rescheduled_by text not null check (rescheduled_by in ('client', 'admin')),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists booking_reschedules_booking_idx on booking_reschedules (booking_id, created_at desc);

-- Read-only for the admin; only reschedule_booking() (security definer) ever writes here.
alter table booking_reschedules enable row level security;
drop policy if exists "booking_reschedules_select_authenticated" on booking_reschedules;
create policy "booking_reschedules_select_authenticated" on booking_reschedules
  for select to authenticated using (true);
revoke all on booking_reschedules from anon;

-- ─── Rate limiting for the public reschedule endpoint ──────────────────────────────────────
-- Serverless instances don't share memory, so an in-process counter wouldn't actually limit
-- anything; api/reschedule-client.ts records one row per request here (service_role only).
create table if not exists api_rate_limit_events (
  id bigint generated always as identity primary key,
  bucket text not null,
  created_at timestamptz not null default now()
);

create index if not exists api_rate_limit_events_bucket_idx on api_rate_limit_events (bucket, created_at);

alter table api_rate_limit_events enable row level security;
revoke all on api_rate_limit_events from anon, authenticated;

-- ─── reschedule_booking ────────────────────────────────────────────────────────────────────
drop function if exists public.reschedule_booking(text, text, date, text);

-- "10:00 AM" → 10. Same parsing as hourFromLabel in src/lib/availability.ts.
create or replace function public.hour_from_slot_label(p_label text)
returns integer
language sql
immutable
as $$
  select case
    when m is null then null
    when m[2] = 'PM' and m[1]::integer <> 12 then m[1]::integer + 12
    when m[2] = 'AM' and m[1]::integer = 12 then 0
    else m[1]::integer
  end
  from (select regexp_match(p_label, '^(\d{1,2}):00\s(AM|PM)$') as m) parsed
$$;

-- Errors are raised with the error code as the message (SLOT_UNAVAILABLE, TOO_LATE,
-- LIMIT_REACHED, INVALID_STATUS, NOT_FOUND, SAME_SLOT) so the API routes can map them
-- without string-matching prose.
--
-- The availability rules below mirror src/lib/availability.ts's computeAvailability exactly
-- (open day + hours, whole-day block, single-hour block, max_slots_per_day, min_gap_hours,
-- min_booking_notice_hours) — keep the two in step. All times are Africa/Lagos.
create or replace function public.reschedule_booking(
  p_booking_id uuid,
  p_new_date date,
  p_new_time text,
  p_actor text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_max_client_reschedules constant integer := 2;
  c_client_window_days constant integer := 14;
  v_booking bookings%rowtype;
  v_new_hour integer;
  v_old_hour integer;
  v_day_key text;
  v_sched schedule_defaults%rowtype;
  v_notice_hours double precision;
  v_now timestamptz := now();
  v_today_wat date := (now() at time zone 'Africa/Lagos')::date;
  v_old_instant timestamptz;
  v_new_instant timestamptz;
  v_other_hours integer[];
  v_reason text := nullif(btrim(p_reason), '');
  v_reminders integer := 0;
begin
  if p_actor is null or p_actor not in ('client', 'admin') then
    raise exception 'INVALID_ACTOR';
  end if;

  v_new_hour := public.hour_from_slot_label(p_new_time);
  if p_new_date is null or v_new_hour is null then
    raise exception 'SLOT_UNAVAILABLE';
  end if;

  -- Serialize every reschedule landing on the same date, so two moves can't both see the
  -- day as having room and both commit (the row lock below only covers this one booking).
  perform pg_advisory_xact_lock(hashtext('reschedule_booking:' || p_new_date::text));

  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if v_booking.status not in ('pending_review', 'quoted', 'deposit_paid', 'confirmed') then
    raise exception 'INVALID_STATUS';
  end if;

  if p_new_date = v_booking.booking_date and p_new_time = v_booking.booking_time then
    raise exception 'SAME_SLOT';
  end if;

  select coalesce((select (value #>> '{}')::double precision from settings where key = 'min_booking_notice_hours'), 0)
    into v_notice_hours;

  -- Client limits: the CURRENT appointment must still be outside the notice window, and at
  -- most two client reschedules per booking. The admin has neither limit.
  if p_actor = 'client' then
    v_old_hour := public.hour_from_slot_label(v_booking.booking_time);
    v_old_instant := (v_booking.booking_date + make_interval(hours => coalesce(v_old_hour, 0))) at time zone 'Africa/Lagos';
    if v_old_hour is null or v_old_instant < v_now + v_notice_hours * interval '1 hour' then
      raise exception 'TOO_LATE';
    end if;
    if v_booking.client_reschedule_count >= c_max_client_reschedules then
      raise exception 'LIMIT_REACHED';
    end if;
  end if;

  -- Availability of the new slot, excluding this booking from every count.
  v_new_instant := (p_new_date + make_interval(hours => v_new_hour)) at time zone 'Africa/Lagos';
  if v_new_instant <= v_now then
    raise exception 'SLOT_UNAVAILABLE';
  end if;
  if p_actor = 'client' then
    if v_new_instant < v_now + v_notice_hours * interval '1 hour'
       or p_new_date > v_today_wat + (c_client_window_days - 1) then
      raise exception 'SLOT_UNAVAILABLE';
    end if;
  end if;

  v_day_key := (array['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])[extract(dow from p_new_date)::integer + 1];
  select * into v_sched from schedule_defaults where day_key = v_day_key;
  if not found or not v_sched.is_open
     or v_new_hour < v_sched.start_hour or v_new_hour > v_sched.end_hour then
    raise exception 'SLOT_UNAVAILABLE';
  end if;

  if exists (
    select 1 from blocked_slots
    where date = p_new_date and (hour is null or hour = v_new_hour)
  ) then
    raise exception 'SLOT_UNAVAILABLE';
  end if;

  select coalesce(array_agg(public.hour_from_slot_label(booking_time)), '{}')
    into v_other_hours
  from bookings
  where booking_date = p_new_date
    and status <> 'cancelled'
    and id <> v_booking.id
    and public.hour_from_slot_label(booking_time) is not null;

  if cardinality(v_other_hours) >= v_sched.max_slots_per_day then
    raise exception 'SLOT_UNAVAILABLE';
  end if;
  if exists (select 1 from unnest(v_other_hours) h where abs(h - v_new_hour) < v_sched.min_gap_hours) then
    raise exception 'SLOT_UNAVAILABLE';
  end if;

  update bookings
  set booking_date = p_new_date,
      booking_time = p_new_time,
      client_reschedule_count = client_reschedule_count + (case when p_actor = 'client' then 1 else 0 end),
      last_rescheduled_at = v_now,
      updated_at = v_now
  where id = v_booking.id;

  -- Reminders are pre-computed rows (005_reminders.sql), so the old ones would still fire at
  -- the old time — including any already marked sent. Rebuild them for the new time; only
  -- confirmed bookings have reminders, same as useBookings' scheduleReminders().
  delete from booking_reminders where booking_id = v_booking.id;
  if v_booking.status = 'confirmed' then
    insert into booking_reminders (booking_id, reminder_type, scheduled_for)
    select v_booking.id, r.reminder_type, v_new_instant - r.offset_interval
    from (values ('24h_before', interval '24 hours'), ('2h_before', interval '2 hours')) as r(reminder_type, offset_interval)
    where v_new_instant - r.offset_interval > v_now;
    get diagnostics v_reminders = row_count;
  end if;

  insert into booking_reschedules (booking_id, old_date, old_start_time, new_date, new_start_time, rescheduled_by, reason)
  values (v_booking.id, v_booking.booking_date, v_booking.booking_time, p_new_date, p_new_time, p_actor, v_reason);

  return jsonb_build_object(
    'booking_id', v_booking.id,
    'old_date', v_booking.booking_date,
    'old_time', v_booking.booking_time,
    'new_date', p_new_date,
    'new_time', p_new_time,
    'rescheduled_by', p_actor,
    'reason', v_reason,
    'client_reschedule_count', v_booking.client_reschedule_count + (case when p_actor = 'client' then 1 else 0 end),
    'reminders_scheduled', v_reminders
  );
end;
$$;

-- Supabase's default privileges grant EXECUTE on new public functions to anon and
-- authenticated, so revoking from public alone wouldn't be enough.
revoke all on function public.reschedule_booking(uuid, date, text, text, text) from public, anon, authenticated;
grant execute on function public.reschedule_booking(uuid, date, text, text, text) to service_role;
