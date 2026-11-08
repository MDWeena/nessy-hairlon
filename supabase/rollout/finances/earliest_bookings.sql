-- READ-ONLY. Rollout step 1: the 5 earliest bookings by created_at, to propose the tracking start.
-- First name only — no phone or email is returned; the flags are computed in SQL.
select
  to_char(b.created_at at time zone 'Africa/Lagos', 'YYYY-MM-DD HH24:MI') as created_lagos,
  b.booking_date as appointment_date,
  b.status,
  split_part(trim(b.client_name), ' ', 1) as first_name,
  concat_ws(', ',
    case when b.client_name ~* 'test' then 'name contains "test"' end,
    case when b.client_name ~* '(nessy|winner|akpologun)' then 'name looks like Nessy / the developer' end,
    case when regexp_replace(b.client_phone, '\D', '', 'g') in (select regexp_replace(value #>> '{}', '\D', '', 'g') from settings where key = 'phone')
         then 'phone = the salon''s own number' end,
    case when b.status = 'cancelled' and b.created_at < (select min(created_at) from bookings where status <> 'cancelled')
         then 'cancelled, made before every non-cancelled booking' end,
    case when b.booking_date < (b.created_at at time zone 'Africa/Lagos')::date then 'appointment before it was made' end
  ) as flags
from bookings b
order by b.created_at
limit 5;
