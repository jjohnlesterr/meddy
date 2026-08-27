-- Real multi-circle Care Circle schema.
-- Run after supabase/schema.sql.

begin;

create table if not exists public.care_circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  invite_code text not null unique default ('MEDDY-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.care_circle_members (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'caregiver', 'family')),
  joined_at timestamptz not null default now(),
  unique (circle_id, user_id)
);

create table if not exists public.care_circle_join_requests (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.care_circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  reviewed_by uuid null references auth.users(id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (circle_id, user_id)
);

create index if not exists care_circle_members_user_id_idx on public.care_circle_members (user_id);
create index if not exists care_circle_members_circle_id_idx on public.care_circle_members (circle_id);
create index if not exists care_circle_join_requests_user_id_idx on public.care_circle_join_requests (user_id);
create index if not exists care_circle_join_requests_circle_id_idx on public.care_circle_join_requests (circle_id);

create or replace function public.is_care_circle_member(target_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.care_circle_members
    where circle_id = target_circle_id and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_care_circle_manager(target_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.care_circle_members
    where circle_id = target_circle_id
      and user_id = (select auth.uid())
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.has_care_circle_request(target_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.care_circle_join_requests
    where circle_id = target_circle_id and user_id = (select auth.uid())
  );
$$;

create or replace function public.can_view_care_circle_profile(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.care_circle_members mine
    join public.care_circle_members theirs on theirs.circle_id = mine.circle_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = target_user_id
  ) or exists (
    select 1
    from public.care_circle_join_requests request
    where request.user_id = target_user_id
      and public.is_care_circle_manager(request.circle_id)
  );
$$;

create or replace function public.add_care_circle_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.care_circle_members (circle_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

drop trigger if exists care_circles_add_owner on public.care_circles;
create trigger care_circles_add_owner
after insert on public.care_circles
for each row execute procedure public.add_care_circle_owner();

create or replace function public.set_care_circle_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists care_circles_set_updated_at on public.care_circles;
create trigger care_circles_set_updated_at
before update on public.care_circles
for each row execute procedure public.set_care_circle_updated_at();

drop trigger if exists care_circle_join_requests_set_updated_at on public.care_circle_join_requests;
create trigger care_circle_join_requests_set_updated_at
before update on public.care_circle_join_requests
for each row execute procedure public.set_care_circle_updated_at();

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

create or replace function public.review_care_circle_join_request(request_id uuid, decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_request public.care_circle_join_requests%rowtype;
begin
  if decision not in ('accepted', 'rejected') then
    raise exception 'Invalid review decision.' using errcode = '22023';
  end if;

  select * into target_request
  from public.care_circle_join_requests
  where id = request_id
  for update;

  if target_request.id is null then
    raise exception 'Join request not found.' using errcode = 'P0001';
  end if;

  if not public.is_care_circle_manager(target_request.circle_id) then
    raise exception 'You cannot review this request.' using errcode = '42501';
  end if;

  update public.care_circle_join_requests
  set status = decision,
      reviewed_by = (select auth.uid()),
      reviewed_at = now()
  where id = request_id;

  if decision = 'accepted' then
    insert into public.care_circle_members (circle_id, user_id, role)
    values (target_request.circle_id, target_request.user_id, 'family')
    on conflict (circle_id, user_id) do nothing;
  end if;
end;
$$;

alter table public.care_circles enable row level security;
alter table public.care_circle_members enable row level security;
alter table public.care_circle_join_requests enable row level security;

revoke all on table public.care_circles from anon, authenticated;
revoke all on table public.care_circle_members from anon, authenticated;
revoke all on table public.care_circle_join_requests from anon, authenticated;
grant select, insert, update, delete on table public.care_circles to authenticated;
grant select, delete on table public.care_circle_members to authenticated;
grant select on table public.care_circle_join_requests to authenticated;

revoke all on function public.is_care_circle_member(uuid) from public;
revoke all on function public.is_care_circle_manager(uuid) from public;
revoke all on function public.has_care_circle_request(uuid) from public;
revoke all on function public.can_view_care_circle_profile(uuid) from public;
revoke all on function public.request_to_join_care_circle(text) from public;
revoke all on function public.review_care_circle_join_request(uuid, text) from public;
grant execute on function public.is_care_circle_member(uuid) to authenticated;
grant execute on function public.is_care_circle_manager(uuid) to authenticated;
grant execute on function public.has_care_circle_request(uuid) to authenticated;
grant execute on function public.can_view_care_circle_profile(uuid) to authenticated;
grant execute on function public.request_to_join_care_circle(text) to authenticated;
grant execute on function public.review_care_circle_join_request(uuid, text) to authenticated;

drop policy if exists "Members can read their Care Circles" on public.care_circles;
create policy "Members can read their Care Circles"
on public.care_circles for select to authenticated
using (
  owner_id = (select auth.uid())
  or public.is_care_circle_member(id)
  or public.has_care_circle_request(id)
);

drop policy if exists "Users can create Care Circles" on public.care_circles;
create policy "Users can create Care Circles"
on public.care_circles for insert to authenticated
with check (owner_id = (select auth.uid()));

drop policy if exists "Managers can update Care Circles" on public.care_circles;
create policy "Managers can update Care Circles"
on public.care_circles for update to authenticated
using (public.is_care_circle_manager(id))
with check (public.is_care_circle_manager(id));

drop policy if exists "Owners can delete Care Circles" on public.care_circles;
create policy "Owners can delete Care Circles"
on public.care_circles for delete to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists "Members can read Circle memberships" on public.care_circle_members;
create policy "Members can read Circle memberships"
on public.care_circle_members for select to authenticated
using (public.is_care_circle_member(circle_id));

drop policy if exists "Members can leave Care Circles" on public.care_circle_members;
create policy "Members can leave Care Circles"
on public.care_circle_members for delete to authenticated
using (user_id = (select auth.uid()) and role <> 'owner');

drop policy if exists "Users can read relevant join requests" on public.care_circle_join_requests;
create policy "Users can read relevant join requests"
on public.care_circle_join_requests for select to authenticated
using (user_id = (select auth.uid()) or public.is_care_circle_manager(circle_id));

drop policy if exists "Care Circle members can read related profiles" on public.profiles;
create policy "Care Circle members can read related profiles"
on public.profiles for select to authenticated
using (public.can_view_care_circle_profile(id));

commit;
