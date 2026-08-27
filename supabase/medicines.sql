-- Meddy medicines and schedules schema.
-- Run this entire file in the Supabase SQL Editor.

begin;

create table if not exists public.medicines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  dosage_value text,
  dosage_unit text,
  form text,
  instructions text,
  notes text null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.medicine_schedules (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid not null references public.medicines(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  time_of_day time not null,
  frequency_type text,
  days_of_week integer[] null,
  meal_timing text null,
  start_date date null,
  end_date date null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists medicines_user_id_idx
on public.medicines using btree (user_id);

create index if not exists medicine_schedules_user_id_idx
on public.medicine_schedules using btree (user_id);

create index if not exists medicine_schedules_medicine_id_idx
on public.medicine_schedules using btree (medicine_id);

create or replace function public.set_medicine_updated_at()
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

drop trigger if exists medicines_set_updated_at on public.medicines;
create trigger medicines_set_updated_at
before update on public.medicines
for each row execute procedure public.set_medicine_updated_at();

alter table public.medicines enable row level security;
alter table public.medicine_schedules enable row level security;

revoke all on table public.medicines from anon, authenticated;
revoke all on table public.medicine_schedules from anon, authenticated;
grant select, insert, update, delete on table public.medicines to authenticated;
grant select, insert, update, delete on table public.medicine_schedules to authenticated;

drop policy if exists "Users can read their own medicines" on public.medicines;
create policy "Users can read their own medicines"
on public.medicines for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own medicines" on public.medicines;
create policy "Users can insert their own medicines"
on public.medicines for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own medicines" on public.medicines;
create policy "Users can update their own medicines"
on public.medicines for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own medicines" on public.medicines;
create policy "Users can delete their own medicines"
on public.medicines for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read schedules for their own medicines" on public.medicine_schedules;
create policy "Users can read schedules for their own medicines"
on public.medicine_schedules for select
to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.medicines
    where public.medicines.id = medicine_schedules.medicine_id
      and public.medicines.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can insert schedules for their own medicines" on public.medicine_schedules;
create policy "Users can insert schedules for their own medicines"
on public.medicine_schedules for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.medicines
    where public.medicines.id = medicine_schedules.medicine_id
      and public.medicines.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can update schedules for their own medicines" on public.medicine_schedules;
create policy "Users can update schedules for their own medicines"
on public.medicine_schedules for update
to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.medicines
    where public.medicines.id = medicine_schedules.medicine_id
      and public.medicines.user_id = (select auth.uid())
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.medicines
    where public.medicines.id = medicine_schedules.medicine_id
      and public.medicines.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can delete schedules for their own medicines" on public.medicine_schedules;
create policy "Users can delete schedules for their own medicines"
on public.medicine_schedules for delete
to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.medicines
    where public.medicines.id = medicine_schedules.medicine_id
      and public.medicines.user_id = (select auth.uid())
  )
);

commit;
