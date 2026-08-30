-- Adds optional personalized voice/audio reminder metadata to medicine schedules.
-- This is separate from `reminder_sound`, which remains the required native
-- alarm channel sound (one of the three bundled Meddy sounds) — personalized
-- audio is never used as the OS notification sound in this pass; it is stored
-- so the app can play it in-app and, later, upload it to Supabase Storage for
-- Care Circle sharing.
-- Run this file after supabase/medicine_reminder_settings.sql.

begin;

alter table public.medicine_schedules
add column if not exists personalized_audio_uri text null;

alter table public.medicine_schedules
add column if not exists personalized_audio_source text null
check (personalized_audio_source is null or personalized_audio_source in ('recorded', 'picked'));

alter table public.medicine_schedules
add column if not exists personalized_audio_label text null;

commit;
