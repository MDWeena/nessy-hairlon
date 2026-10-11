-- SECURITY FIX: style_reference_urls (018_style_reference_urls.sql) accepted any well-formed
-- URL a client typed — an admin reviewing the booking would then open whatever link was
-- submitted, with no check it actually pointed at a real style-reference platform (phishing,
-- malware, anything). src/lib/validation.ts's isTrustedStyleReferenceUrl() already enforces an
-- exact-hostname whitelist client-side, but the anon INSERT policy's WITH CHECK doesn't
-- reference this column (it's legitimately client-provided, same as custom_style_url — see
-- 014_harden_booking_insert.sql's own comment on that), and the app has no server-side API
-- layer for booking creation to validate in either — createBooking() in src/hooks/useBookings.ts
-- inserts directly via the Supabase client. This constraint is the only enforcement a client
-- calling the REST API directly (bypassing the app's own JS) can't bypass.
--
-- The whitelist below must be kept in sync by hand with TRUSTED_STYLE_REFERENCE_DOMAINS in
-- src/constants/trustedDomains.ts — Postgres has no way to import a TS/JS source of truth, and
-- this schema has no existing table either value could live in instead.
create or replace function is_trusted_style_reference_url(url text)
returns boolean
language plpgsql
immutable
as $$
declare
  host text;
begin
  if url !~ '^https://' then
    return false;
  end if;
  host := lower(substring(url from '^https://([^/?#:]+)'));
  if host is null then
    return false;
  end if;
  return host = any(array[
    'instagram.com', 'www.instagram.com',
    'pinterest.com', 'www.pinterest.com', 'pin.it', 'in.pinterest.com',
    'tiktok.com', 'www.tiktok.com', 'vm.tiktok.com',
    'youtube.com', 'www.youtube.com', 'youtu.be',
    'twitter.com', 'x.com',
    'facebook.com', 'www.facebook.com', 'web.facebook.com'
  ]);
end;
$$;

-- Postgres CHECK constraints can't contain a subquery (even over the row's own column), so the
-- per-element loop has to live in its own function rather than inline in the constraint below.
create or replace function are_style_reference_urls_trusted(urls jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  value text;
begin
  for value in select jsonb_array_elements_text(urls) loop
    if not is_trusted_style_reference_url(value) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

alter table bookings
  add constraint style_reference_urls_trusted_domains
  check (are_style_reference_urls_trusted(style_reference_urls));
