-- Scheduled appointment reminders. Rows are created client-side (by
-- useBookings.updateBookingStatus, admin-authenticated) when a booking is
-- confirmed, and consumed by the api/process-reminders.ts cron job using the
-- service-role key — that job bypasses RLS entirely, so the policy below only
-- governs the (currently unused) case of a browser reading/writing this table
-- directly, which should only ever be an authenticated admin session.

create table if not exists booking_reminders (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('24h_before', '2h_before')),
  scheduled_for timestamptz not null,
  sent_at timestamptz default null,
  channel text not null default 'email' check (channel in ('email', 'whatsapp')),
  created_at timestamptz not null default now()
);

create index if not exists booking_reminders_due_idx on booking_reminders (scheduled_for) where sent_at is null;

alter table booking_reminders enable row level security;

create policy "booking_reminders_all_authenticated" on booking_reminders
  for all to authenticated using (true) with check (true);
