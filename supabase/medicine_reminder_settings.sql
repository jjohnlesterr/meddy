-- Adds reminder preferences to existing medicine schedules.
-- Run this file after supabase/medicines.sql.

begin;

alter table public.medicine_schedules
add column if not exists reminder_sound text not null default 'gentle_chime'
check (reminder_sound in ('gentle_chime', 'soft_bell', 'morning_tone'));

alter table public.medicine_schedules
add column if not exists vibration_enabled boolean not null default true;

alter table public.medicine_schedules
add column if not exists snooze_enabled boolean not null default true;

alter table public.medicine_schedules
add column if not exists snooze_minutes integer not null default 10
check (snooze_minutes in (5, 10, 15));

commit;
