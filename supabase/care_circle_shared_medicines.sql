-- Adds shared medicines and real activity to Care Circles.
-- Run after supabase/schema.sql, supabase/medicines.sql, and supabase/care_circles.sql.

begin;

alter table public.medicines
add column if not exists care_circle_id uuid null
references public.care_circles(id) on delete cascade;

create index if not exists medicines_care_circle_id_idx
on public.medicines (care_circle_id);

create table if not exists public.care_circle_activity (
  id uuid primary key default gen_random_uuid(),
  care_circle_id uuid not null references public.care_circles(id) on delete cascade,
  event_type text not null check (event_type in (
    'medicine_added',
    'medicine_updated',
    'medicine_deleted',
    'member_joined',
    'member_left',
    'circle_updated',
    'dose_taken',
    'dose_snoozed',
    'dose_skipped',
    'dose_missed'
  )),
  medicine_id uuid null references public.medicines(id) on delete set null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  subject_user_id uuid null references auth.users(id) on delete set null,
  scheduled_time timestamptz null,
  action_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists care_circle_activity_circle_created_idx
on public.care_circle_activity (care_circle_id, created_at desc);

create index if not exists care_circle_activity_medicine_id_idx
on public.care_circle_activity (medicine_id);

create or replace function public.can_edit_care_circle_medicines(target_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.care_circle_members
    where circle_id = target_circle_id
      and user_id = (select auth.uid())
      and role in ('owner', 'admin', 'caregiver')
  );
$$;

create or replace function public.can_delete_care_circle_medicines(target_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.care_circle_members
    where circle_id = target_circle_id
      and user_id = (select auth.uid())
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.preserve_medicine_owner_and_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.user_id is distinct from new.user_id
    or old.care_circle_id is distinct from new.care_circle_id then
    raise exception 'Medicine ownership and scope cannot be changed.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists medicines_preserve_owner_and_scope on public.medicines;
create trigger medicines_preserve_owner_and_scope
before update on public.medicines
for each row execute procedure public.preserve_medicine_owner_and_scope();

create or replace function public.preserve_schedule_owner_and_medicine()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.user_id is distinct from new.user_id
    or old.medicine_id is distinct from new.medicine_id then
    raise exception 'Schedule ownership and medicine cannot be changed.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists medicine_schedules_preserve_owner on public.medicine_schedules;
create trigger medicine_schedules_preserve_owner
before update on public.medicine_schedules
for each row execute procedure public.preserve_schedule_owner_and_medicine();

create or replace function public.log_care_circle_medicine_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_circle_id uuid;
  target_medicine_id uuid;
  target_name text;
  target_event text;
begin
  if tg_op = 'INSERT' then
    target_circle_id := new.care_circle_id;
    target_medicine_id := new.id;
    target_name := new.name;
    target_event := 'medicine_added';
  elsif tg_op = 'UPDATE' then
    target_circle_id := new.care_circle_id;
    target_medicine_id := new.id;
    target_name := new.name;
    target_event := 'medicine_updated';
  else
    target_circle_id := old.care_circle_id;
    target_medicine_id := null;
    target_name := old.name;
    target_event := 'medicine_deleted';
  end if;

  if target_circle_id is not null and exists (
    select 1 from public.care_circles where id = target_circle_id
  ) then
    insert into public.care_circle_activity (
      care_circle_id,
      event_type,
      medicine_id,
      actor_user_id,
      metadata
    ) values (
      target_circle_id,
      target_event,
      target_medicine_id,
      (select auth.uid()),
      jsonb_build_object('medicine_name', target_name)
    );
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists medicines_log_care_circle_activity on public.medicines;
create trigger medicines_log_care_circle_activity
after insert or update or delete on public.medicines
for each row execute procedure public.log_care_circle_medicine_activity();

create or replace function public.log_care_circle_member_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_circle_id uuid;
begin
  if tg_op = 'INSERT' then
    target_circle_id := new.circle_id;
  else
    target_circle_id := old.circle_id;
  end if;

  if not exists (
    select 1
    from public.care_circles
    where id = target_circle_id
  ) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.care_circle_activity (
      care_circle_id,
      event_type,
      actor_user_id,
      subject_user_id,
      metadata
    ) values (
      new.circle_id,
      'member_joined',
      (select auth.uid()),
      new.user_id,
      jsonb_build_object('role', new.role)
    );
    return new;
  end if;

  insert into public.care_circle_activity (
    care_circle_id,
    event_type,
    actor_user_id,
    subject_user_id,
    metadata
  ) values (
    old.circle_id,
    'member_left',
    (select auth.uid()),
    old.user_id,
    jsonb_build_object('role', old.role)
  );
  return old;
end;
$$;

drop trigger if exists care_circle_members_log_activity on public.care_circle_members;
create trigger care_circle_members_log_activity
after insert or delete on public.care_circle_members
for each row execute procedure public.log_care_circle_member_activity();

create or replace function public.log_care_circle_settings_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.name is distinct from new.name then
    insert into public.care_circle_activity (
      care_circle_id,
      event_type,
      actor_user_id,
      metadata
    ) values (
      new.id,
      'circle_updated',
      (select auth.uid()),
      jsonb_build_object('old_name', old.name, 'new_name', new.name)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists care_circles_log_settings_activity on public.care_circles;
create trigger care_circles_log_settings_activity
after update on public.care_circles
for each row execute procedure public.log_care_circle_settings_activity();

alter table public.care_circle_activity enable row level security;

revoke all on table public.care_circle_activity from anon, authenticated;
grant select on table public.care_circle_activity to authenticated;

revoke all on function public.can_edit_care_circle_medicines(uuid) from public;
revoke all on function public.can_delete_care_circle_medicines(uuid) from public;
revoke all on function public.preserve_medicine_owner_and_scope() from public;
revoke all on function public.preserve_schedule_owner_and_medicine() from public;
revoke all on function public.log_care_circle_medicine_activity() from public;
revoke all on function public.log_care_circle_member_activity() from public;
revoke all on function public.log_care_circle_settings_activity() from public;
grant execute on function public.can_edit_care_circle_medicines(uuid) to authenticated;
grant execute on function public.can_delete_care_circle_medicines(uuid) to authenticated;

drop policy if exists "Owners can delete Care Circles" on public.care_circles;
drop policy if exists "Managers can delete Care Circles" on public.care_circles;
create policy "Managers can delete Care Circles"
on public.care_circles for delete to authenticated
using (public.is_care_circle_manager(id));

drop policy if exists "Users can read their own medicines" on public.medicines;
drop policy if exists "Users can insert their own medicines" on public.medicines;
drop policy if exists "Users can update their own medicines" on public.medicines;
drop policy if exists "Users can delete their own medicines" on public.medicines;
drop policy if exists "Users can read accessible medicines" on public.medicines;
drop policy if exists "Users can create permitted medicines" on public.medicines;
drop policy if exists "Users can update permitted medicines" on public.medicines;
drop policy if exists "Users can delete permitted medicines" on public.medicines;

create policy "Users can read accessible medicines"
on public.medicines for select to authenticated
using (
  (care_circle_id is null and user_id = (select auth.uid()))
  or (care_circle_id is not null and public.is_care_circle_member(care_circle_id))
);

create policy "Users can create permitted medicines"
on public.medicines for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (
    care_circle_id is null
    or public.can_edit_care_circle_medicines(care_circle_id)
  )
);

create policy "Users can update permitted medicines"
on public.medicines for update to authenticated
using (
  (care_circle_id is null and user_id = (select auth.uid()))
  or (care_circle_id is not null and public.can_edit_care_circle_medicines(care_circle_id))
)
with check (
  (care_circle_id is null and user_id = (select auth.uid()))
  or (care_circle_id is not null and public.can_edit_care_circle_medicines(care_circle_id))
);

create policy "Users can delete permitted medicines"
on public.medicines for delete to authenticated
using (
  (care_circle_id is null and user_id = (select auth.uid()))
  or (care_circle_id is not null and public.can_delete_care_circle_medicines(care_circle_id))
);

drop policy if exists "Users can read schedules for their own medicines" on public.medicine_schedules;
drop policy if exists "Users can insert schedules for their own medicines" on public.medicine_schedules;
drop policy if exists "Users can update schedules for their own medicines" on public.medicine_schedules;
drop policy if exists "Users can delete schedules for their own medicines" on public.medicine_schedules;
drop policy if exists "Users can read accessible medicine schedules" on public.medicine_schedules;
drop policy if exists "Users can create permitted medicine schedules" on public.medicine_schedules;
drop policy if exists "Users can update permitted medicine schedules" on public.medicine_schedules;
drop policy if exists "Users can delete permitted medicine schedules" on public.medicine_schedules;

create policy "Users can read accessible medicine schedules"
on public.medicine_schedules for select to authenticated
using (
  exists (
    select 1
    from public.medicines
    where public.medicines.id = medicine_schedules.medicine_id
      and (
        (public.medicines.care_circle_id is null and public.medicines.user_id = (select auth.uid()))
        or (
          public.medicines.care_circle_id is not null
          and public.is_care_circle_member(public.medicines.care_circle_id)
        )
      )
  )
);

create policy "Users can create permitted medicine schedules"
on public.medicine_schedules for insert to authenticated
with check (
  user_id = (select auth.uid())
  and
  exists (
    select 1
    from public.medicines
    where public.medicines.id = medicine_schedules.medicine_id
      and (
        (public.medicines.care_circle_id is null and public.medicines.user_id = (select auth.uid()))
        or (
          public.medicines.care_circle_id is not null
          and public.can_edit_care_circle_medicines(public.medicines.care_circle_id)
        )
      )
  )
);

create policy "Users can update permitted medicine schedules"
on public.medicine_schedules for update to authenticated
using (
  exists (
    select 1
    from public.medicines
    where public.medicines.id = medicine_schedules.medicine_id
      and (
        (public.medicines.care_circle_id is null and public.medicines.user_id = (select auth.uid()))
        or (
          public.medicines.care_circle_id is not null
          and public.can_edit_care_circle_medicines(public.medicines.care_circle_id)
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.medicines
    where public.medicines.id = medicine_schedules.medicine_id
      and (
        (public.medicines.care_circle_id is null and public.medicines.user_id = (select auth.uid()))
        or (
          public.medicines.care_circle_id is not null
          and public.can_edit_care_circle_medicines(public.medicines.care_circle_id)
        )
      )
  )
);

create policy "Users can delete permitted medicine schedules"
on public.medicine_schedules for delete to authenticated
using (
  exists (
    select 1
    from public.medicines
    where public.medicines.id = medicine_schedules.medicine_id
      and (
        (public.medicines.care_circle_id is null and public.medicines.user_id = (select auth.uid()))
        or (
          public.medicines.care_circle_id is not null
          and public.can_edit_care_circle_medicines(public.medicines.care_circle_id)
        )
      )
  )
);

drop policy if exists "Members can read Care Circle activity" on public.care_circle_activity;
create policy "Members can read Care Circle activity"
on public.care_circle_activity for select to authenticated
using (public.is_care_circle_member(care_circle_id));

commit;
