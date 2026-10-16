-- Removes the legacy, phone-only self-service paths that 022 left in place for the old frontend.
--
-- ┌─────────────────────────────────────────────────────────────────────────────────────────┐
-- │ APPLY ONLY AFTER THE NEW FRONTEND IS LIVE IN PRODUCTION (the build that reschedules via  │
-- │ /api/reschedule-client, cancels via /api/cancel-client and books via create_booking()). │
-- │ Applied any earlier, the live Track Booking page's Reschedule and Cancel buttons and    │
-- │ the live booking form all stop working.                                                 │
-- └─────────────────────────────────────────────────────────────────────────────────────────┘
--
-- Why each one goes:
--   * reschedule_booking(text, text, date, text) (007/016): anyone with a reference + phone
--     could move a booking, with no availability check (straight onto a blocked day, a full
--     day, or inside another booking's gap) and no reschedule limit. Replaced by
--     reschedule_booking(uuid, ...) behind api/reschedule-client.ts.
--   * cancel_booking(text, text) (007): same phone-only check, callable straight from the
--     browser with no rate limit and no notifications. Replaced by cancel_booking_by_id()
--     behind api/cancel-client.ts. Only EXECUTE is revoked (not dropped) so it stays
--     available to service_role/SQL for manual use.
--   * the bookings_insert_anon policy (014/022): a direct anon INSERT skips the per-date lock
--     and the capacity/gap/blocked-day checks that create_booking() runs, so leaving it in
--     place would let anyone bypass the booking race fix by calling the REST API directly.

drop function if exists public.reschedule_booking(text, text, date, text);

revoke all on function public.cancel_booking(text, text) from public, anon, authenticated;

drop policy if exists "bookings_insert_anon" on bookings;
