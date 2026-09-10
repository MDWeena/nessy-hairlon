-- Nessy Hairlon — initial schema
-- Tables, row-level security policies, and seed data per Architecture.md

create extension if not exists pgcrypto;

-- ─── services ───────────────────────────────────────────────
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null,
  description text not null,
  duration text not null,
  price text,
  price_range_min integer,
  price_range_max integer,
  icon_name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table services enable row level security;

create policy "services_select_anon" on services
  for select to anon using (true);

create policy "services_all_authenticated" on services
  for all to authenticated using (true) with check (true);

-- ─── schedule_defaults ──────────────────────────────────────
create table if not exists schedule_defaults (
  id uuid primary key default gen_random_uuid(),
  day_key text not null unique check (day_key in ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
  is_open boolean not null default true,
  start_hour integer not null default 9,
  end_hour integer not null default 17
);

alter table schedule_defaults enable row level security;

create policy "schedule_defaults_select_anon" on schedule_defaults
  for select to anon using (true);

create policy "schedule_defaults_all_authenticated" on schedule_defaults
  for all to authenticated using (true) with check (true);

-- ─── blocked_slots ──────────────────────────────────────────
create table if not exists blocked_slots (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  hour integer,
  reason text,
  created_at timestamptz not null default now()
);

alter table blocked_slots enable row level security;

create policy "blocked_slots_select_anon" on blocked_slots
  for select to anon using (true);

create policy "blocked_slots_all_authenticated" on blocked_slots
  for all to authenticated using (true) with check (true);

-- ─── bookings ───────────────────────────────────────────────
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  client_phone text not null,
  client_email text,
  booking_date date not null,
  booking_time text not null,
  service_ids uuid[] not null default '{}',
  custom_style_url text,
  custom_style_description text,
  status text not null default 'pending_review'
    check (status in ('pending_review','quoted','confirmed','completed','cancelled')),
  quoted_price integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table bookings enable row level security;

create policy "bookings_select_anon" on bookings
  for select to anon using (true);

create policy "bookings_insert_anon" on bookings
  for insert to anon with check (true);

create policy "bookings_all_authenticated" on bookings
  for all to authenticated using (true) with check (true);

-- ─── testimonials ───────────────────────────────────────────
create table if not exists testimonials (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  review_text text not null,
  stars integer not null check (stars between 1 and 5),
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table testimonials enable row level security;

create policy "testimonials_select_anon" on testimonials
  for select to anon using (is_visible = true);

create policy "testimonials_all_authenticated" on testimonials
  for all to authenticated using (true) with check (true);

-- ─── gallery ────────────────────────────────────────────────
create table if not exists gallery (
  id uuid primary key default gen_random_uuid(),
  day_of_week text not null unique check (day_of_week in
    ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  style_name text not null,
  image_url text,
  updated_at timestamptz not null default now()
);

alter table gallery enable row level security;

create policy "gallery_select_anon" on gallery
  for select to anon using (true);

create policy "gallery_all_authenticated" on gallery
  for all to authenticated using (true) with check (true);

-- ─── settings ───────────────────────────────────────────────
create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null
);

alter table settings enable row level security;

create policy "settings_select_anon" on settings
  for select to anon using (true);

create policy "settings_all_authenticated" on settings
  for all to authenticated using (true) with check (true);

-- ─── seed data ──────────────────────────────────────────────

insert into services (category, name, description, duration, price, price_range_min, price_range_max, icon_name, sort_order) values
  ('Styling', 'Braiding', 'Cornrows, box braids, knotless & more', '3-6 hrs', null, 15000, 45000, 'Sparkles', 0),
  ('Styling', 'Locs', 'Starter locs, retwist & styling', '2-5 hrs', null, 10000, 35000, 'Sparkles', 1),
  ('Styling', 'Crotcheting', 'Crotchet braids & twists', '2-4 hrs', null, 12000, 30000, 'Sparkles', 2),
  ('Styling', 'Fixing', 'Weave-on & sew-in styles', '2-3 hrs', null, 8000, 25000, 'Sparkles', 3),
  ('Styling', 'Wigging', 'Custom wig install & styling', '1-2 hrs', null, 10000, 20000, 'Sparkles', 4),
  ('Treatments', 'Natural Hair Treatment', 'Full natural hair care routine', '1-2 hrs', '₦8,000', null, null, 'Heart', 5),
  ('Treatments', 'Washing', 'Shampoo, condition & blow-dry', '45 min', '₦5,000', null, null, 'Heart', 6),
  ('Treatments', 'Deep Conditioning', 'Intensive moisture & repair', '1 hr', '₦7,000', null, null, 'Heart', 7),
  ('Treatments', 'Hot Oil Treatment', 'Scalp nourishment & shine', '45 min', '₦6,000', null, null, 'Heart', 8),
  ('Treatments', 'Protein Treatment', 'Strengthen & restore damaged hair', '1 hr', '₦8,000', null, null, 'Heart', 9);

insert into schedule_defaults (day_key, is_open, start_hour, end_hour) values
  ('Mon', true, 9, 17),
  ('Tue', true, 9, 16),
  ('Wed', true, 9, 17),
  ('Thu', true, 10, 16),
  ('Fri', true, 9, 16),
  ('Sat', true, 10, 15),
  ('Sun', false, 0, 0);

insert into testimonials (client_name, review_text, stars, is_visible, sort_order) values
  ('Amara O.', 'I drove 3 hours to get my locs done. Worth every minute. She understands natural hair like no one else.', 5, true, 0),
  ('Chidinma E.', 'My braids lasted 8 weeks and my scalp felt amazing the entire time. The treatments are top tier.', 5, true, 1),
  ('Bola A.', 'Finally found someone who treats natural hair with the care it deserves. I won''t go anywhere else.', 5, true, 2);

insert into gallery (day_of_week, style_name, image_url) values
  ('Monday', 'Goddess Locs', null),
  ('Tuesday', 'Knotless Braids', null),
  ('Wednesday', 'Fulani Braids', null),
  ('Thursday', 'Passion Twists', null),
  ('Friday', 'Feed-in Cornrows', null),
  ('Saturday', 'Butterfly Locs', null),
  ('Sunday', 'Bohemian Twists', null);

insert into settings (key, value) values
  ('business_name', '"Nessy Hairlon"'),
  ('phone', '"0816 127 1343"'),
  ('instagram', '"@nessy_hairlon"'),
  ('bank_name', '"GTBank"'),
  ('account_number', '"012 345 6789"'),
  ('account_name', '"Nessy Hairlon"'),
  ('deposit_percentage', '50'),
  ('slot_duration_minutes', '60'),
  ('min_booking_notice_hours', '24');
