

do $$
declare fp_after text; n_after bigint; bad int;
begin
  -- 1. No existing booking changed (every original column of every row).
  select count(*), md5(string_agg(md5(row_to_json(x)::text), '' order by x.id)) into n_after, fp_after from (select id, client_name, client_phone, client_email, booking_date, booking_time, service_ids, custom_style_url, custom_style_description, status, quoted_price, notes, created_at, updated_at, deposit_confirmed_at, payment_proof_url, attachment_preference, attachment_items, accessory_items, hair_service_cost, balance_paid_at, balance_reminder_sent_at, reference_code, style_reference_urls, client_notes, custom_style_category, client_reschedule_count, last_rescheduled_at from bookings) x;
  if (select n from _fp_before) <> n_after or (select fp from _fp_before) is distinct from fp_after then
    raise exception 'CHECK FAILED: bookings fingerprint changed';
  end if;
  -- 2. New columns empty.
  if exists (select 1 from bookings where product_cost is not null or product_cost_note is not null) then
    raise exception 'CHECK FAILED: product cost columns not empty';
  end if;
  -- 3. anon / authenticated keep exactly their pre-024 privileges on every existing table/view.
  select count(*) into bad from (
    (select * from _grants_before except
     select table_name::text, grantee::text, privilege_type::text from information_schema.role_table_grants where grantee in ('anon','authenticated') and table_schema='public')
    union all
    (select table_name::text, grantee::text, privilege_type::text from information_schema.role_table_grants
       where grantee in ('anon','authenticated') and table_schema='public'
         and table_name not in ('payments','cost_rates','expenses','recurring_expenses','category_product_costs','finance_config','monthly_reports')
     except select * from _grants_before)) d;
  if bad <> 0 then raise exception 'CHECK FAILED: % privilege(s) on existing objects changed', bad; end if;
  -- 4. No anon privilege at all on the new tables.
  if exists (select 1 from information_schema.role_table_grants where grantee = 'anon' and table_schema='public'
             and table_name in ('payments','cost_rates','expenses','recurring_expenses','category_product_costs','finance_config','monthly_reports')) then
    raise exception 'CHECK FAILED: anon has a privilege on a new finance table';
  end if;
  -- 5. Backfill: only backfill rows, at most one per confirmed timestamp, original timestamps, positive amounts.
  if exists (select 1 from payments where source <> 'backfill' or amount <= 0) then raise exception 'CHECK FAILED: unexpected payment rows'; end if;
  if (select count(*) from payments where kind='deposit') > (select deposits from _counts_before)
     or (select count(*) from payments where kind='balance') > (select balances from _counts_before)
     or exists (select 1 from payments where kind='refund') then
    raise exception 'CHECK FAILED: backfill row counts';
  end if;
  if exists (select 1 from payments p join bookings b on b.id = p.booking_id
             where (p.kind='deposit' and p.received_at is distinct from b.deposit_confirmed_at)
                or (p.kind='balance' and p.received_at is distinct from b.balance_paid_at)) then
    raise exception 'CHECK FAILED: backfill timestamps';
  end if;
  -- 6. Starting rates; tracking start NOT set (chosen and confirmed in a later step).
  if (select count(*) from cost_rates) <> 2
     or not exists (select 1 from cost_rates where kind='staff_salary' and amount=30000)
     or not exists (select 1 from cost_rates where kind='transport_daily' and amount=1500) then
    raise exception 'CHECK FAILED: starting rates';
  end if;
  if exists (select 1 from finance_config where key = 'tracking_start_date') then raise exception 'CHECK FAILED: tracking start already set'; end if;
end $$;

commit;

select (select count(*) from bookings) as bookings,
       (select count(*) from payments where kind='deposit') as backfilled_deposits,
       (select count(*) from payments where kind='balance') as backfilled_balances,
       (select coalesce(sum(amount),0) from payments) as backfilled_total,
       (select json_agg(json_build_object('kind',kind,'amount',amount)) from cost_rates) as rates;
