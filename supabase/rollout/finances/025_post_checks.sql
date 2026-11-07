
do $$ declare removed int; added int; begin
  select count(*) into removed from (select * from _g except select table_name::text, grantee::text, privilege_type::text from information_schema.role_table_grants where grantee in ('anon','authenticated') and table_schema='public') x;
  select count(*) into added from (select table_name::text, grantee::text, privilege_type::text from information_schema.role_table_grants where grantee in ('anon','authenticated') and table_schema='public' except select * from _g) x;
  if removed <> 1 or added <> 0 or has_table_privilege('anon', 'bookings', 'select') then raise exception 'CHECK FAILED: expected exactly anon SELECT on bookings removed (removed %, added %)', removed, added; end if;
  if not has_table_privilege('anon', 'public_booking_slots', 'select') then raise exception 'CHECK FAILED: calendar view lost'; end if;
end $$;
commit;
select has_table_privilege('anon','bookings','select') as anon_select_bookings, has_table_privilege('anon','bookings','insert') as anon_insert_priv_kept;
