-- Rollout step 3: set the CONFIRMED tracking start. Replace __TRACKING_START__ (YYYY-MM-DD) only
-- after the user has confirmed it. Starting rates (₦30,000 salary/month, ₦1,500 per hair day)
-- were inserted by 024 and apply from the tracking start.
-- Also sets month_close_auto_from to __CURRENT_MONTH__ (YYYY-MM): the daily cron will NOT close any
-- earlier month (e.g. October) — Nessy closes those herself ("Close this month now"), or the user
-- moves this setting back and the next cron run catches them up.
begin;
insert into finance_config (key, value, updated_at) values ('month_close_auto_from', to_jsonb('__CURRENT_MONTH__'::text), now())
on conflict (key) do update set value = excluded.value, updated_at = now();
insert into finance_config (key, value, updated_at) values ('tracking_start_date', to_jsonb('__TRACKING_START__'::text), now())
on conflict (key) do update set value = excluded.value, updated_at = now();
commit;
select key, value #>> '{}' as value from finance_config;
select kind, amount, effective_from from cost_rates order by kind, effective_from;
