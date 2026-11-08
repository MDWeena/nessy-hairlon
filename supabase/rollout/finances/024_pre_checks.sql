-- Generated into one transaction by build.sh: 024_pre_checks.sql + 024_finances.sql + 024_post_checks.sql.
-- Apply 024 in ONE transaction with in-transaction checks. Any failed check raises → everything rolls back.
begin;
set local lock_timeout = '5s';

create temporary table _fp_before on commit drop as
  select count(*) as n, md5(string_agg(md5(row_to_json(x)::text), '' order by x.id)) as fp from (select id, client_name, client_phone, client_email, booking_date, booking_time, service_ids, custom_style_url, custom_style_description, status, quoted_price, notes, created_at, updated_at, deposit_confirmed_at, payment_proof_url, attachment_preference, attachment_items, accessory_items, hair_service_cost, balance_paid_at, balance_reminder_sent_at, reference_code, style_reference_urls, client_notes, custom_style_category, client_reschedule_count, last_rescheduled_at from bookings) x;
create temporary table _grants_before on commit drop as
  select table_name::text, grantee::text, privilege_type::text from information_schema.role_table_grants
  where grantee in ('anon', 'authenticated') and table_schema = 'public';
create temporary table _counts_before on commit drop as
  select (select count(*) from bookings where deposit_confirmed_at is not null) as deposits,
         (select count(*) from bookings where balance_paid_at is not null) as balances;

