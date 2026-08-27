-- Fix: "column reference \"circle_id\" is ambiguous" when tapping "Request to Join".
--
-- Root cause: public.request_to_join_care_circle(...) is declared
--   returns table (circle_id uuid, circle_name text, request_status text)
-- so `circle_id` is an OUT variable in scope for the whole function body. The
-- original body then ran:
--   insert into public.care_circle_join_requests (...)
--   on conflict (circle_id, user_id) do update ...
-- PostgreSQL resolves the names in the ON CONFLICT inference clause and finds
-- both the OUT variable `circle_id` and the column `circle_id`, so it raises
-- `column reference "circle_id" is ambiguous` and the whole request fails.
--
-- This migration replaces only that function. The signature is unchanged, so
-- CREATE OR REPLACE keeps the existing EXECUTE grant; the grant is re-asserted
-- below for safety. Nothing else in the Care Circle schema changes.
--
-- Behaviour preserved:
--   * Entering a code never creates membership; it only creates a pending request.
--   * Already-members get status 'member' and no request row is created.
--   * Re-requesting refreshes the existing row to 'pending' (no duplicate rows;
--     the unique (circle_id, user_id) constraint from care_circles.sql still holds).
--   * Owner/Admin still accept or reject via review_care_circle_join_request.
--   * RLS, roles, and shared-medicine behaviour are untouched.
--
-- Run this whole file once in the Supabase SQL Editor.

begin;

create or replace function public.request_to_join_care_circle(requested_code text)
returns table (circle_id uuid, circle_name text, request_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_circle public.care_circles%rowtype;
  requester_id uuid := (select auth.uid());
  existing_role text;
  next_status text;
begin
  if requester_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select * into target_circle
  from public.care_circles
  where upper(invite_code) = upper(trim(requested_code));

  if target_circle.id is null then
    raise exception 'Care Circle code not found.' using errcode = 'P0001';
  end if;

  select member.role into existing_role
  from public.care_circle_members as member
  where member.circle_id = target_circle.id
    and member.user_id = requester_id;

  -- Already a member: never create a join request, just report the current state.
  if existing_role is not null then
    return query select target_circle.id, target_circle.name, 'member'::text;
    return;
  end if;

  -- Refresh an existing request back to pending; the unique (circle_id, user_id)
  -- constraint means this can only ever touch one row, so no duplicate is created.
  update public.care_circle_join_requests as request
  set status = 'pending',
      reviewed_by = null,
      reviewed_at = null,
      updated_at = now()
  where request.circle_id = target_circle.id
    and request.user_id = requester_id
  returning request.status into next_status;

  -- No existing request: create a fresh pending one. A concurrent insert that
  -- wins the race is caught and folded back into a pending refresh.
  if next_status is null then
    begin
      insert into public.care_circle_join_requests (circle_id, user_id, status)
      values (target_circle.id, requester_id, 'pending')
      returning status into next_status;
    exception when unique_violation then
      update public.care_circle_join_requests as request
      set status = 'pending',
          reviewed_by = null,
          reviewed_at = null,
          updated_at = now()
      where request.circle_id = target_circle.id
        and request.user_id = requester_id
      returning request.status into next_status;
    end;
  end if;

  return query select target_circle.id, target_circle.name, next_status;
end;
$$;

revoke all on function public.request_to_join_care_circle(text) from public;
grant execute on function public.request_to_join_care_circle(text) to authenticated;

commit;
