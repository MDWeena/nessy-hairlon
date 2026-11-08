-- Finances module: a payments ledger, business costs (rate history, expenses, recurring
-- expenses, per-category typical product cost), month-close snapshots, and a private per-booking
-- product cost.
--
-- SAFE TO APPLY TO A LIVE DATABASE: this migration only ADDS. It creates new tables, adds two
-- nullable columns to bookings (no default → no table rewrite, every existing row reads NULL),
-- and INSERTs into the NEW tables only (the payments backfill and initial rates/config). It never
-- UPDATEs or DELETEs an existing row, and it changes NO permission on any existing object: anon
-- keeps exactly the access it had before 024. (anon still can't read bookings rows — RLS has had
-- no anon SELECT policy since 002 — so the new product-cost columns aren't readable by anon
-- either.) Revoking anon's table-level privilege on bookings is a separate step: 025, applied
-- only after the new frontend has been live for ~24h.
--
-- Not set here, because they need confirming first: the tracking start date (chosen in
-- Settings → Business costs, or by the rollout step). The starting rates below apply from
-- whatever the tracking start is.
--
-- Every new table: RLS on, the signed-in admin (authenticated) only, nothing for anon. The
-- month-close cron writes monthly_reports with the service role.

-- ─── 1. Private product cost per booking ───────────────────────────────────────────────────
alter table bookings
  add column if not exists product_cost integer,
  add column if not exists product_cost_note text;

alter table bookings drop constraint if exists product_cost_non_negative;
alter table bookings add constraint product_cost_non_negative check (product_cost is null or product_cost >= 0);

-- Clients only ever reach bookings through public_booking_slots (3 columns), security-definer
-- functions (lookup_bookings, create_booking, mark_deposit_paid, submit_review) and the server API
-- (service role) — none return these columns, and anon has no SELECT policy on bookings.

-- ─── 2. Payments ledger ────────────────────────────────────────────────────────────────────
-- One row per payment as confirmed by the admin, with the amount AT THAT MOMENT, so editing a
-- price later can't change history. 'refund' records a deposit returned on a cancellation.
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  kind text not null check (kind in ('deposit', 'balance', 'refund')),
  amount integer not null check (amount >= 0),
  received_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  source text not null default 'app' check (source in ('app', 'backfill')),
  note text,
  created_at timestamptz not null default now(),
  -- At most one of each kind per booking (re-confirming can't double-count).
  constraint payments_one_per_kind unique (booking_id, kind)
);
create index if not exists payments_received_idx on payments (received_at);

-- ─── 3. Business costs ─────────────────────────────────────────────────────────────────────
-- Rate history: the rate on a day is the latest row with effective_from on or before it.
create table if not exists cost_rates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('staff_salary', 'transport_daily')),
  amount integer not null check (amount >= 0),
  effective_from date not null,
  created_at timestamptz not null default now(),
  constraint cost_rates_one_per_day unique (kind, effective_from)
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  category text not null check (category in ('Equipment & tools', 'Rent & utilities', 'Data & phone', 'Marketing & adverts', 'Supplies (bulk)', 'Training', 'Other')),
  amount integer not null check (amount >= 0),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists expenses_date_idx on expenses (expense_date);

-- A monthly cost (e.g. rent) from start_date until end_date (inclusive; null = still running).
-- Changing the amount = ending one row and starting another, so past months never change.
create table if not exists recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('Equipment & tools', 'Rent & utilities', 'Data & phone', 'Marketing & adverts', 'Supplies (bulk)', 'Training', 'Other')),
  amount integer not null check (amount >= 0),
  note text,
  start_date date not null,
  end_date date,
  created_at timestamptz not null default now(),
  constraint recurring_expenses_dates check (end_date is null or end_date >= start_date)
);

-- Typical product cost per service category — prefills "Products you'll use" when quoting.
create table if not exists category_product_costs (
  category text primary key,
  typical_cost integer not null check (typical_cost >= 0),
  updated_at timestamptz not null default now()
);

-- Finance settings (e.g. the tracking start date). Kept out of the public settings table,
-- which anon can read.
create table if not exists finance_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ─── 4. Month-close snapshots ──────────────────────────────────────────────────────────────
create table if not exists monthly_reports (
  month date primary key check (extract(day from month) = 1),
  figures jsonb not null,
  insights jsonb not null,
  closed_at timestamptz not null default now()
);

-- ─── 5. Access: admin only ─────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['payments', 'cost_rates', 'expenses', 'recurring_expenses', 'category_product_costs', 'finance_config', 'monthly_reports'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_admin_all', t);
    execute format('create policy %I on %I for all to authenticated using (true) with check (true)', t || '_admin_all', t);
    execute format('revoke all on %I from anon', t);
    -- Explicit rather than relying on Supabase's default privileges.
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('grant all on %I to service_role', t);
  end loop;
end $$;

-- ─── 6. Starting data (new tables only) ────────────────────────────────────────────────────
-- Starting rates (confirmed by Nessy): staff salary ₦30,000 a month; transport ₦1,500 per hair
-- day (a day with at least one appointment). '2000-01-01' means "from the tracking start": no day
-- before the tracking start is ever counted, so the starting rate covers every tracked day
-- whatever start date is chosen. Later changes are added with their own effective-from date.
insert into cost_rates (kind, amount, effective_from) values
  ('staff_salary', 30000, date '2000-01-01'),
  ('transport_daily', 1500, date '2000-01-01')
on conflict (kind, effective_from) do nothing;


-- ─── 7. Backfill the ledger from existing confirmed deposits / paid balances ───────────────
-- Same formulas as src/lib/payments.ts (calculateDepositAmount / calculateBalanceAmount), using
-- each booking's current price and the existing timestamps. Rows are marked source = 'backfill'.
-- Reads bookings; writes payments only.
with pct as (
  select (select (value #>> '{}')::numeric from settings where key = 'deposit_percentage') as deposit_pct
),
b as (
  select bk.*,
    coalesce((select sum((i->>'quantity')::numeric * (i->>'unit_cost')::numeric) from jsonb_array_elements(coalesce(bk.attachment_items, '[]'::jsonb)) i), 0)
      + coalesce((select sum((i->>'quantity')::numeric * (i->>'unit_cost')::numeric) from jsonb_array_elements(coalesce(bk.accessory_items, '[]'::jsonb)) i), 0) as materials
  from bookings bk
),
amounts as (
  select b.id, b.deposit_confirmed_at, b.balance_paid_at, b.quoted_price,
    case
      when b.quoted_price is null then null
      when b.attachment_preference = 'nessy_buys' and b.hair_service_cost is not null then round(b.materials + b.hair_service_cost * 0.5)
      when (select deposit_pct from pct) is not null then round(b.quoted_price * (select deposit_pct from pct) / 100)
    end as deposit
  from b
)
insert into payments (booking_id, kind, amount, received_at, source, created_by)
select id, 'deposit', deposit::integer, deposit_confirmed_at, 'backfill', null::uuid
from amounts where deposit_confirmed_at is not null and deposit is not null and deposit > 0
union all
select id, 'balance',
  (case when deposit_confirmed_at is null then quoted_price else greatest(0, quoted_price - deposit) end)::integer,
  balance_paid_at, 'backfill', null::uuid
from amounts
where balance_paid_at is not null and quoted_price is not null
  and (deposit_confirmed_at is null or deposit is not null)
  and (case when deposit_confirmed_at is null then quoted_price else greatest(0, quoted_price - deposit) end) > 0
on conflict (booking_id, kind) do nothing;
