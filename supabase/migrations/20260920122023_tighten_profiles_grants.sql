-- Tighten table grants on public.profiles for signed-in users.
--
-- Supabase's default privileges gave `authenticated` every table privilege
-- (DELETE, TRUNCATE, REFERENCES, TRIGGER in addition to what Meddy needs).
-- The baseline supabase/schema.sql intends only select, insert, update.
--
-- The app reads, upserts (insert + update) and updates profiles, and never
-- deletes one; profile rows are removed only by the ON DELETE CASCADE from
-- auth.users. RLS stays enabled with the existing own-row policies; grants are
-- a second layer, not a replacement. TRUNCATE in particular is not subject to
-- RLS, so it should not be granted to client roles.

begin;

revoke delete, truncate, references, trigger on table public.profiles from authenticated;
grant select, insert, update on table public.profiles to authenticated;

commit;
