-- Generated into one transaction by build.sh: 025_pre_checks.sql + 025_lock_down_anon_bookings.sql + 025_post_checks.sql.
begin;
set local lock_timeout = '5s';
create temporary table _g on commit drop as select table_name::text t, grantee::text g, privilege_type::text p from information_schema.role_table_grants where grantee in ('anon','authenticated') and table_schema='public';
