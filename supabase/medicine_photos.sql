-- Adds an optional photo to each medicine so the medicine owner and
-- authorized Care Circle members can visually identify it.
--
-- Run this file after: supabase/schema.sql, supabase/medicines.sql,
-- supabase/care_circles.sql, and supabase/care_circle_shared_medicines.sql
-- (the last one defines can_edit_care_circle_medicines,
-- can_delete_care_circle_medicines, and is_care_circle_member, which the
-- Storage policies below depend on).
--
-- NOT YET APPLIED — for review. Do not run against the project until the
-- Meddy engineer/owner has reviewed the RLS policies below.
--
-- Object path convention (set by the app, not enforced by a DB constraint):
--   {medicine_id}/photo.jpg
-- The app always normalizes a photo to JPEG before upload, so the path for a
-- given medicine is deterministic. That means "replace" is just an
-- overwrite (upload with upsert: true) — there is never an orphaned old
-- object to separately clean up, and "remove" is a single delete of that one
-- known path. One photo per medicine — a new upload overwrites the previous
-- one in place.
--
-- Safe to re-run: the column add is guarded, the bucket insert no-ops on
-- conflict, and every policy is dropped (if present) and re-created.

begin;

-- ---------------------------------------------------------------------------
-- 1. Canonical photo path on medicines
-- ---------------------------------------------------------------------------
alter table public.medicines
add column if not exists photo_storage_path text null;

comment on column public.medicines.photo_storage_path is
  'Supabase Storage object path in the private medicine-photos bucket, e.g. {medicine_id}/photo.jpg. Canonical, cross-device value — null means no photo.';

-- ---------------------------------------------------------------------------
-- 2. Storage bucket (private — never public)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('medicine-photos', 'medicine-photos', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Storage RLS
-- ---------------------------------------------------------------------------
-- Do NOT run `alter table storage.objects enable row level security` (or any
-- other ALTER TABLE against storage.objects) here — that table is owned by
-- Supabase's internal `supabase_storage_admin` role, not by the `postgres`
-- role this SQL runs as, so the statement fails with
-- "must be owner of table objects" (SQLSTATE 42501). It's also unnecessary:
-- Supabase ships storage.objects with row level security enabled by default.
-- CREATE POLICY / DROP POLICY on storage.objects, below, is the supported,
-- documented way to manage Storage access and does not require table
-- ownership.
--
-- Every policy below matches the object's medicine by comparing
-- (storage.foldername(name))[1] — the first path segment — to
-- medicines.id::text. This is a plain text comparison, not a uuid cast, so a
-- malformed or unexpected path segment simply fails to match any medicine
-- (access denied) instead of raising a cast error.

drop policy if exists "Medicine editors can upload a medicine photo" on storage.objects;
create policy "Medicine editors can upload a medicine photo"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'medicine-photos'
  and exists (
    select 1
    from public.medicines m
    where m.id::text = (storage.foldername(name))[1]
      and (
        (m.care_circle_id is null and m.user_id = (select auth.uid()))
        or (m.care_circle_id is not null and public.can_edit_care_circle_medicines(m.care_circle_id))
      )
  )
);

drop policy if exists "Medicine editors can replace a medicine photo" on storage.objects;
create policy "Medicine editors can replace a medicine photo"
on storage.objects for update to authenticated
using (
  bucket_id = 'medicine-photos'
  and exists (
    select 1
    from public.medicines m
    where m.id::text = (storage.foldername(name))[1]
      and (
        (m.care_circle_id is null and m.user_id = (select auth.uid()))
        or (m.care_circle_id is not null and public.can_edit_care_circle_medicines(m.care_circle_id))
      )
  )
)
with check (
  bucket_id = 'medicine-photos'
  and exists (
    select 1
    from public.medicines m
    where m.id::text = (storage.foldername(name))[1]
      and (
        (m.care_circle_id is null and m.user_id = (select auth.uid()))
        or (m.care_circle_id is not null and public.can_edit_care_circle_medicines(m.care_circle_id))
      )
  )
);

drop policy if exists "Medicine owners can delete a medicine photo" on storage.objects;
create policy "Medicine owners can delete a medicine photo"
on storage.objects for delete to authenticated
using (
  bucket_id = 'medicine-photos'
  and exists (
    select 1
    from public.medicines m
    where m.id::text = (storage.foldername(name))[1]
      and (
        (m.care_circle_id is null and m.user_id = (select auth.uid()))
        or (m.care_circle_id is not null and public.can_delete_care_circle_medicines(m.care_circle_id))
      )
  )
);

drop policy if exists "Medicine viewers can read a medicine photo" on storage.objects;
create policy "Medicine viewers can read a medicine photo"
on storage.objects for select to authenticated
using (
  bucket_id = 'medicine-photos'
  and exists (
    select 1
    from public.medicines m
    where m.id::text = (storage.foldername(name))[1]
      and (
        (m.care_circle_id is null and m.user_id = (select auth.uid()))
        or (m.care_circle_id is not null and public.is_care_circle_member(m.care_circle_id))
      )
  )
);

commit;
