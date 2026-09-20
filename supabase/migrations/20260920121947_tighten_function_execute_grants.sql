-- Tighten EXECUTE grants on public functions.
--
-- Problem: Supabase's default privileges grant EXECUTE on every new public
-- function to anon and authenticated, and three functions were also
-- executable by PUBLIC. The earlier `revoke all ... from public` statements in
-- the baseline SQL never removed the explicit anon/authenticated grants, so
-- anonymous users could call all 18 public functions through /rest/v1/rpc.
--
-- Access after this migration (postgres and service_role keep EXECUTE):
--
--   Trigger functions (fired by triggers, never called by clients):
--     no access for anon, authenticated or PUBLIC.
--       add_care_circle_owner, handle_new_user, log_care_circle_medicine_activity,
--       log_care_circle_member_activity, log_care_circle_settings_activity,
--       preserve_medicine_owner_and_scope, preserve_schedule_owner_and_medicine,
--       set_care_circle_updated_at, set_medicine_updated_at, set_updated_at
--     Postgres checks EXECUTE on a trigger function when the trigger is created,
--     not when it fires, so sign-up and normal writes are unaffected.
--     handle_new_user is also granted to supabase_auth_admin (the role that
--     inserts into auth.users) so the sign-up trigger keeps its explicit grant
--     now that PUBLIC no longer provides one.
--
--   RLS helper functions (evaluated inside policies as the signed-in user):
--     authenticated only.
--       is_care_circle_member, is_care_circle_manager, has_care_circle_request,
--       can_view_care_circle_profile, can_edit_care_circle_medicines,
--       can_delete_care_circle_medicines
--     Every policy that uses them is `to authenticated`, so anon never needs them.
--
--   Client RPCs: authenticated only.
--       request_to_join_care_circle, review_care_circle_join_request
--     Both already reject callers without auth.uid().

begin;

-- Trigger functions: nobody calls these directly.
revoke execute on function public.add_care_circle_owner() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.log_care_circle_medicine_activity() from public, anon, authenticated;
revoke execute on function public.log_care_circle_member_activity() from public, anon, authenticated;
revoke execute on function public.log_care_circle_settings_activity() from public, anon, authenticated;
revoke execute on function public.preserve_medicine_owner_and_scope() from public, anon, authenticated;
revoke execute on function public.preserve_schedule_owner_and_medicine() from public, anon, authenticated;
revoke execute on function public.set_care_circle_updated_at() from public, anon, authenticated;
revoke execute on function public.set_medicine_updated_at() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

grant execute on function public.handle_new_user() to supabase_auth_admin;

-- RLS helpers and client RPCs: signed-in users only.
revoke execute on function public.is_care_circle_member(uuid) from public, anon;
revoke execute on function public.is_care_circle_manager(uuid) from public, anon;
revoke execute on function public.has_care_circle_request(uuid) from public, anon;
revoke execute on function public.can_view_care_circle_profile(uuid) from public, anon;
revoke execute on function public.can_edit_care_circle_medicines(uuid) from public, anon;
revoke execute on function public.can_delete_care_circle_medicines(uuid) from public, anon;
revoke execute on function public.request_to_join_care_circle(text) from public, anon;
revoke execute on function public.review_care_circle_join_request(uuid, text) from public, anon;

grant execute on function public.is_care_circle_member(uuid) to authenticated;
grant execute on function public.is_care_circle_manager(uuid) to authenticated;
grant execute on function public.has_care_circle_request(uuid) to authenticated;
grant execute on function public.can_view_care_circle_profile(uuid) to authenticated;
grant execute on function public.can_edit_care_circle_medicines(uuid) to authenticated;
grant execute on function public.can_delete_care_circle_medicines(uuid) to authenticated;
grant execute on function public.request_to_join_care_circle(text) to authenticated;
grant execute on function public.review_care_circle_join_request(uuid, text) to authenticated;

commit;
