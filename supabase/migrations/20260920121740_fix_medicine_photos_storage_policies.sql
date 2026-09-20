-- Fix: medicine-photos Storage policies never matched any object.
--
-- Root cause: each policy checks
--   exists (select 1 from public.medicines m
--           where m.id::text = (storage.foldername(name))[1] ...)
-- Inside that subquery the unqualified `name` resolves to public.medicines.name
-- (the innermost scope wins), not storage.objects.name. The first path segment
-- of a medicine's *name* never equals a medicine id, so every upload, read,
-- replace and delete on the medicine-photos bucket was denied for everyone.
--
-- Fix: qualify the reference as objects.name (the storage.objects row being
-- checked). Nothing else changes: same bucket, same roles, same ownership and
-- Care Circle rules, bucket stays private.
--
-- Object paths remain `{medicine_id}/photo.jpg`.

begin;

drop policy if exists "Medicine editors can upload a medicine photo" on storage.objects;
create policy "Medicine editors can upload a medicine photo"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'medicine-photos'
  and exists (
    select 1
    from public.medicines m
    where m.id::text = (storage.foldername(objects.name))[1]
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
    where m.id::text = (storage.foldername(objects.name))[1]
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
    where m.id::text = (storage.foldername(objects.name))[1]
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
    where m.id::text = (storage.foldername(objects.name))[1]
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
    where m.id::text = (storage.foldername(objects.name))[1]
      and (
        (m.care_circle_id is null and m.user_id = (select auth.uid()))
        or (m.care_circle_id is not null and public.is_care_circle_member(m.care_circle_id))
      )
  )
);

commit;
