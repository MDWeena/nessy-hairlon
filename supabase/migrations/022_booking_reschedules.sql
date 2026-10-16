-- Booking rescheduling (client + admin), server-side booking creation, and verified client
-- cancellation.
--
-- BACKWARD COMPATIBLE: this migration only ADDS. Everything the currently-live frontend calls
-- keeps working — the legacy reschedule_booking(text, text, date, text), the legacy
-- cancel_booking(text, text), and direct anon INSERTs into bookings. Those are removed by
-- 023_drop_legacy_functions.sql, which must only be applied once the new frontend is live.
--
-- New, all with the availability rules in ONE place (assert_slot_available) under ONE per-date
-- lock (lock_booking_date), so new bookings and reschedules serialize against each other:
--   * reschedule_booking(uuid, date, text, text, text) — service_role only (api/reschedule-*)
--   * cancel_booking_by_id(uuid)                       — service_role only (api/cancel-client)
--   * create_booking(...)                              — anon/authenticated (booking form)
-- Errors are raised with the error code as the message (SLOT_UNAVAILABLE, TOO_LATE,
-- LIMIT_REACHED, INVALID_STATUS, NOT_FOUND, SAME_SLOT, INVALID_REQUEST) so callers can map
-- them without string-matching prose. All times are Africa/Lagos.

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
-- when that column was added. (023 drops this policy entirely once the live frontend creates
-- bookings through create_booking() instead; until then the live site still needs it.)
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

-- ─── Rate limiting for the public endpoints ────────────────────────────────────────────────
-- Serverless instances don't share memory, so an in-process counter wouldn't actually limit
-- anything; api/reschedule-client.ts and api/cancel-client.ts record one row per request here
-- (service_role only).
create table if not exists api_rate_limit_events (
  id bigint generated always as identity primary key,
  bucket text not null,
  created_at timestamptz not null default now()
);

create index if not exists api_rate_limit_events_bucket_idx on api_rate_limit_events (bucket, created_at);

alter table api_rate_limit_events enable row level security;
revoke all on api_rate_limit_events from anon, authenticated;

-- ─── Shared slot helpers ───────────────────────────────────────────────────────────────────

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

-- One transaction-scoped lock per calendar date, taken by every function that can put a
-- booking onto that date. The row lock / unique index alone can't stop two transactions that
-- each see "room on this day" from both committing and overfilling it.
create or replace function public.lock_booking_date(p_date date)
returns void
language sql
as $$
  select pg_advisory_xact_lock(hashtext('booking_slot:' || p_date::text))
$$;

-- Raises SLOT_UNAVAILABLE unless (p_date, p_hour) is genuinely bookable. Mirrors
-- src/lib/availability.ts's computeAvailability exactly — open day + hours, whole-day block,
-- single-hour block, max_slots_per_day, min_gap_hours, and (client rules only)
-- min_booking_notice_hours plus the 14-day booking window. Keep the two in step.
-- p_exclude_booking_id: a booking being moved, left out of every count.
create or replace function public.assert_slot_available(
  p_date date,
  p_hour integer,
  p_exclude_booking_id uuid,
  p_client_rules boolean
)
returns void
language plpgsql
set search_path = public
as $$
declare
  c_client_window_days constant integer := 14;
  v_now timestamptz := now();
  v_today_wat date := (now() at time zone 'Africa/Lagos')::date;
  v_instant timestamptz;
  v_notice_hours double precision;
  v_sched schedule_defaults%rowtype;
  v_other_hours integer[];
begin
  if p_date is null or p_hour is null then
    raise exception 'SLOT_UNAVAILABLE';
  end if;

  v_instant := (p_date + make_interval(hours => p_hour)) at time zone 'Africa/Lagos';
  if v_instant <= v_now then
    raise exception 'SLOT_UNAVAILABLE';
  end if;

  if p_client_rules then
    select coalesce((select (value #>> '{}')::double precision from settings where key = 'min_booking_notice_hours'), 0)
      into v_notice_hours;
    if v_instant < v_now + v_notice_hours * interval '1 hour'
       or p_date > v_today_wat + (c_client_window_days - 1) then
      raise exception 'SLOT_UNAVAILABLE';
    end if;
  end if;

  select * into v_sched from schedule_defaults
  where day_key = (array['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])[extract(dow from p_date)::integer + 1];
  if not found or not v_sched.is_open or p_hour < v_sched.start_hour or p_hour > v_sched.end_hour then
    raise exception 'SLOT_UNAVAILABLE';
  end if;

  if exists (select 1 from blocked_slots where date = p_date and (hour is null or hour = p_hour)) then
    raise exception 'SLOT_UNAVAILABLE';
  end if;

  select coalesce(array_agg(public.hour_from_slot_label(booking_time)), '{}')
    into v_other_hours
  from bookings
  where booking_date = p_date
    and status <> 'cancelled'
    and (p_exclude_booking_id is null or id <> p_exclude_booking_id)
    and public.hour_from_slot_label(booking_time) is not null;

  if cardinality(v_other_hours) >= v_sched.max_slots_per_day then
    raise exception 'SLOT_UNAVAILABLE';
  end if;
  if exists (select 1 from unnest(v_other_hours) h where abs(h - p_hour) < v_sched.min_gap_hours) then
    raise exception 'SLOT_UNAVAILABLE';
  end if;
end;
$$;

-- Internal helpers: only ever called from the security-definer functions below (which run as
-- the owner), never directly by a client. Supabase's default privileges grant EXECUTE on new
-- public functions to anon and authenticated, so revoking from public alone wouldn't be enough.
revoke all on function public.lock_booking_date(date) from public, anon, authenticated;
revoke all on function public.assert_slot_available(date, integer, uuid, boolean) from public, anon, authenticated;

-- ─── reschedule_booking ────────────────────────────────────────────────────────────────────
-- Coexists with the legacy reschedule_booking(text, text, date, text) until 023 — PostgREST
-- tells the two apart by their argument names.
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
  v_booking bookings%rowtype;
  v_new_hour integer;
  v_old_hour integer;
  v_notice_hours double precision;
  v_now timestamptz := now();
  v_old_instant timestamptz;
  v_new_instant timestamptz;
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

  perform public.lock_booking_date(p_new_date);

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

  -- Client limits: the CURRENT appointment must still be outside the notice window, and at
  -- most two client reschedules per booking. The admin has neither limit.
  if p_actor = 'client' then
    select coalesce((select (value #>> '{}')::double precision from settings where key = 'min_booking_notice_hours'), 0)
      into v_notice_hours;
    v_old_hour := public.hour_from_slot_label(v_booking.booking_time);
    v_old_instant := (v_booking.booking_date + make_interval(hours => coalesce(v_old_hour, 0))) at time zone 'Africa/Lagos';
    if v_old_hour is null or v_old_instant < v_now + v_notice_hours * interval '1 hour' then
      raise exception 'TOO_LATE';
    end if;
    if v_booking.client_reschedule_count >= c_max_client_reschedules then
      raise exception 'LIMIT_REACHED';
    end if;
  end if;

  -- The admin skips the notice window and the 14-day window, but not availability.
  perform public.assert_slot_available(p_new_date, v_new_hour, v_booking.id, p_actor = 'client');
  v_new_instant := (p_new_date + make_interval(hours => v_new_hour)) at time zone 'Africa/Lagos';

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

revoke all on function public.reschedule_booking(uuid, date, text, text, text) from public, anon, authenticated;
grant execute on function public.reschedule_booking(uuid, date, text, text, text) to service_role;

-- ─── cancel_booking_by_id ──────────────────────────────────────────────────────────────────
-- Client self-service cancel, called by api/cancel-client.ts only after it has verified the
-- reference + phone/email itself. Same status rule as the legacy cancel_booking(text, text):
-- anything but completed/cancelled. (The admin cancels through the Orders page directly.)
create or replace function public.cancel_booking_by_id(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings%rowtype;
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_booking.status in ('completed', 'cancelled') then
    raise exception 'INVALID_STATUS';
  end if;

  update bookings set status = 'cancelled', updated_at = now() where id = v_booking.id;
  -- process-reminders already skips cancelled bookings, but there's no reason to keep them.
  delete from booking_reminders where booking_id = v_booking.id and sent_at is null;

  return jsonb_build_object(
    'booking_id', v_booking.id,
    'previous_status', v_booking.status,
    'date', v_booking.booking_date,
    'time', v_booking.booking_time
  );
end;
$$;

revoke all on function public.cancel_booking_by_id(uuid) from public, anon, authenticated;
grant execute on function public.cancel_booking_by_id(uuid) to service_role;

-- ─── create_booking ────────────────────────────────────────────────────────────────────────
-- The booking form's insert path. Takes the same per-date lock as reschedule_booking and runs
-- the full availability check (client rules) before inserting, so two simultaneous requests
-- can't overfill a day or land inside each other's minimum gap — the partial unique index on
-- (booking_date, booking_time) from 015 still guards the exact-same-slot case. Only the columns
-- a client may set are accepted; every admin/system column takes its default.
create or replace function public.create_booking(
  p_client_name text,
  p_client_phone text,
  p_client_email text,
  p_booking_date date,
  p_booking_time text,
  p_service_ids uuid[] default '{}',
  p_custom_style_url text default null,
  p_custom_style_description text default null,
  p_style_reference_urls jsonb default '[]'::jsonb,
  p_client_notes text default null,
  p_attachment_preference text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hour integer;
  v_id uuid;
begin
  if coalesce(btrim(p_client_name), '') = '' or coalesce(btrim(p_client_phone), '') = '' then
    raise exception 'INVALID_REQUEST';
  end if;

  v_hour := public.hour_from_slot_label(p_booking_time);
  if p_booking_date is null or v_hour is null then
    raise exception 'SLOT_UNAVAILABLE';
  end if;

  perform public.lock_booking_date(p_booking_date);
  perform public.assert_slot_available(p_booking_date, v_hour, null, true);

  insert into bookings (
    client_name, client_phone, client_email, booking_date, booking_time, service_ids,
    custom_style_url, custom_style_description, style_reference_urls, client_notes, attachment_preference
  ) values (
    btrim(p_client_name), btrim(p_client_phone), nullif(btrim(p_client_email), ''), p_booking_date, p_booking_time,
    coalesce(p_service_ids, '{}'), p_custom_style_url, p_custom_style_description,
    coalesce(p_style_reference_urls, '[]'::jsonb), p_client_notes, p_attachment_preference
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_booking(text, text, text, date, text, uuid[], text, text, jsonb, text, text) from public;
grant execute on function public.create_booking(text, text, text, date, text, uuid[], text, text, jsonb, text, text) to anon, authenticated, service_role;
