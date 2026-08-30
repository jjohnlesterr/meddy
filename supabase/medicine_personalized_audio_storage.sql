-- Extends the personalized-audio metadata added in
-- supabase/medicine_personalized_audio.sql with the fields needed to make a
-- recording/import a real cross-device value instead of a device-local file
-- URI, and creates the private Supabase Storage bucket + RLS policies that
-- back it.
--
-- Run this file after supabase/medicine_personalized_audio.sql.
--
-- NOT YET APPLIED — for review. Do not run against the project until the
-- Meddy engineer/owner has reviewed the RLS policies below.

begin;

-- ---------------------------------------------------------------------------
-- 1. New metadata columns on medicine_schedules
-- ---------------------------------------------------------------------------
-- `personalized_audio_uri` (already added) is now documented as a device-local
-- cache hint only — it is NOT synced between devices and must never be treated
-- as the source of truth. `personalized_audio_storage_path` is the canonical,
-- cross-device value: the object path inside the `personalized-reminder-audio`
-- Storage bucket.
comment on column public.medicine_schedules.personalized_audio_uri is
  'Device-local file URI cache for personalized reminder audio. Not synced across devices — see personalized_audio_storage_path for the canonical value.';

alter table public.medicine_schedules
add column if not exists personalized_audio_storage_path text null;

alter table public.medicine_schedules
add column if not exists personalized_audio_duration_seconds integer null
check (
  personalized_audio_duration_seconds is null
  or (personalized_audio_duration_seconds > 0 and personalized_audio_duration_seconds <= 30)
);

alter table public.medicine_schedules
add column if not exists personalized_audio_created_by uuid null references auth.users(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 2. Storage bucket (private — never public)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('personalized-reminder-audio', 'personalized-reminder-audio', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Storage RLS
-- ---------------------------------------------------------------------------
-- Object path convention (set by the app, not enforced by a DB constraint):
--   {owner_user_id}/{random_id}.{ext}
-- The owner segment gates write access. Read access is granted either to the
-- owner, or — via a lookup against medicine_schedules, matched on the exact
-- stored path rather than parsing an id out of the path — to any authenticated
-- Care Circle member of the circle the associated medicine belongs to. Using
-- an exact-path match (not a schedule-id-in-path convention) means a
-- recording can be uploaded and previewed before a medicine/schedule row
-- exists yet, since the schedule is only linked to the path afterwards, on
-- save.
--
-- Do NOT run `alter table storage.objects enable row level security` (or any
-- other ALTER TABLE against storage.objects) here — that table is owned by
-- Supabase's internal `supabase_storage_admin` role, not by the `postgres`
-- role this SQL runs as, so the statement fails with
-- "must be owner of table objects" (SQLSTATE 42501). It's also unnecessary:
-- Supabase ships storage.objects with row level security enabled by default.
-- CREATE POLICY / DROP POLICY on storage.objects, below, is the supported,
-- documented way to manage Storage access and does not require table
-- ownership.

drop policy if exists "Users can upload their own personalized audio" on storage.objects;
create policy "Users can upload their own personalized audio"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'personalized-reminder-audio'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can replace their own personalized audio" on storage.objects;
create policy "Users can replace their own personalized audio"
on storage.objects for update to authenticated
using (
  bucket_id = 'personalized-reminder-audio'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'personalized-reminder-audio'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can delete their own personalized audio" on storage.objects;
create policy "Users can delete their own personalized audio"
on storage.objects for delete to authenticated
using (
  bucket_id = 'personalized-reminder-audio'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Owners and Care Circle members can read personalized audio" on storage.objects;
create policy "Owners and Care Circle members can read personalized audio"
on storage.objects for select to authenticated
using (
  bucket_id = 'personalized-reminder-audio'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (
      select 1
      from public.medicine_schedules ms
      join public.medicines m on m.id = ms.medicine_id
      where ms.personalized_audio_storage_path = storage.objects.name
        and m.care_circle_id is not null
        and public.is_care_circle_member(m.care_circle_id)
    )
  )
);

commit;
