-- Stop new public functions from being executable by anon/authenticated by default.
--
-- Supabase's default privileges automatically grant EXECUTE on every function
-- that the postgres role creates in the public schema to anon, authenticated
-- and service_role. Every new SECURITY DEFINER function therefore became
-- callable through /rest/v1/rpc unless a migration remembered to revoke it.
--
-- This removes the anon and authenticated entries from postgres's default
-- function privileges in schema public. service_role and postgres keep theirs.
-- Existing functions are not changed. A new function that a client must call
-- is now granted explicitly, for example:
--   grant execute on function public.some_rpc(uuid) to authenticated;
--
-- What this does NOT cover (deliberately):
--   * PUBLIC. PostgreSQL grants EXECUTE to PUBLIC on new functions through a
--     global default, and a per-schema ALTER DEFAULT PRIVILEGES cannot remove
--     it. Because anon inherits PUBLIC, a new function is still callable by anon
--     until its migration runs:
--       revoke execute on function public.some_fn(...) from public;
--     A global change (without IN SCHEMA) would also strip PUBLIC from
--     functions postgres creates in other schemas, such as extension functions
--     in the extensions schema, and could break them, so it is not applied.
--   * Functions created by supabase_admin. postgres cannot change that role's
--     defaults. Meddy's migrations run as postgres, so this does not affect them.

begin;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

commit;
