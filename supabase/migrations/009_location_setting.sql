-- Google Maps link for the footer's location link. Defaults to a generic
-- "Lagos, Nigeria" search; the admin can replace it with an exact pin via
-- Settings once available.
insert into settings (key, value)
values ('location_url', '"https://www.google.com/maps/search/?api=1&query=Lagos,Nigeria"')
on conflict (key) do nothing;
