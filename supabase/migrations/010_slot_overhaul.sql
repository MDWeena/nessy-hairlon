-- Slot system overhaul: every day is now open (Sunday with shorter hours for
-- church), and per-day capacity/spacing rules are added so the app can cap
-- how many appointments land on one day and keep them spread out.

update schedule_defaults
  set is_open = true, start_hour = 10, end_hour = 16
  where day_key in ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat');

update schedule_defaults
  set is_open = true, start_hour = 13, end_hour = 16
  where day_key = 'Sun';

alter table schedule_defaults add column if not exists max_slots_per_day integer not null default 3;
alter table schedule_defaults add column if not exists min_gap_hours integer not null default 3;

update schedule_defaults set max_slots_per_day = 2 where day_key = 'Sun';
update schedule_defaults set max_slots_per_day = 3 where day_key <> 'Sun';
update schedule_defaults set min_gap_hours = 3;
