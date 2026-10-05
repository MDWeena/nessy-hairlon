-- BUG FIX (pre-launch audit): race condition. createBooking (src/hooks/useBookings.ts)
-- only checks client-side whether a slot looks free (via useAvailability's snapshot)
-- before inserting — there was no database-level constraint stopping two clients who
-- both load the calendar at nearly the same moment from each successfully inserting a
-- booking for the exact same date+time. Nothing in the app ever reconciled that after
-- the fact; both bookings would simply sit there, double-booked, until an admin noticed.
--
-- A partial unique index on (booking_date, booking_time) — excluding cancelled bookings,
-- since a cancelled slot legitimately frees up the time for someone else — makes the
-- second concurrent insert fail at the database level with a unique-violation error
-- instead of silently succeeding. src/hooks/useBookings.ts's createBooking() is updated
-- separately (not in this migration) to catch that specific error and surface a friendly
-- "that slot was just taken" message instead of a raw constraint-violation string.

create unique index if not exists bookings_date_time_unique
  on bookings (booking_date, booking_time)
  where status <> 'cancelled';
