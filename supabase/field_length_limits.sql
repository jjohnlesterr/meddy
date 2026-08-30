-- Adds maximum-length CHECK constraints matching the client-side input
-- limits, so a bypassed/buggy client can never write data the UI wouldn't
-- have accepted. Nullable columns stay nullable — only an upper bound is
-- added for them. Existing NOT NULL / non-blank behavior is preserved as-is.
--
-- Run this file after: supabase/schema.sql, supabase/medicines.sql,
-- supabase/care_circles.sql, and supabase/medicine_personalized_audio.sql
-- (the last one adds medicine_schedules.personalized_audio_label — this file
-- will fail with "column does not exist" if that migration hasn't run yet).
--
-- NOT YET APPLIED — for review. Do not run against the project until the
-- Meddy engineer/owner has confirmed no existing rows violate the pre-flight
-- checks below (the migration also checks this itself and aborts with a
-- clear message rather than a raw constraint-violation error, but the
-- underlying data would still need to be fixed before this can succeed).
--
-- Safe to re-run: every constraint is dropped (if present) and re-added, and
-- the pre-flight checks are read-only.

begin;

-- ---------------------------------------------------------------------------
-- 0. Pre-flight: abort with a clear, specific message if any existing row
--    would violate one of the new limits, instead of a generic Postgres
--    check-violation error partway through the migration.
-- ---------------------------------------------------------------------------
do $$
declare
  bad_count integer;
begin
  select count(*) into bad_count from public.medicines
  where char_length(trim(name)) = 0 or char_length(trim(name)) > 80;
  if bad_count > 0 then
    raise exception 'medicines.name: % row(s) are blank or exceed 80 characters. Check: select id, name from public.medicines where char_length(trim(name)) = 0 or char_length(trim(name)) > 80;', bad_count;
  end if;

  select count(*) into bad_count from public.medicines
  where dosage_value is not null and char_length(trim(dosage_value)) > 50;
  if bad_count > 0 then
    raise exception 'medicines.dosage_value: % row(s) exceed 50 characters. Check: select id, dosage_value from public.medicines where dosage_value is not null and char_length(trim(dosage_value)) > 50;', bad_count;
  end if;

  select count(*) into bad_count from public.medicines
  where dosage_unit is not null and char_length(trim(dosage_unit)) > 50;
  if bad_count > 0 then
    raise exception 'medicines.dosage_unit: % row(s) exceed 50 characters. Check: select id, dosage_unit from public.medicines where dosage_unit is not null and char_length(trim(dosage_unit)) > 50;', bad_count;
  end if;

  select count(*) into bad_count from public.medicines
  where instructions is not null and char_length(trim(instructions)) > 200;
  if bad_count > 0 then
    raise exception 'medicines.instructions: % row(s) exceed 200 characters. Check: select id, instructions from public.medicines where instructions is not null and char_length(trim(instructions)) > 200;', bad_count;
  end if;

  select count(*) into bad_count from public.medicines
  where notes is not null and char_length(trim(notes)) > 500;
  if bad_count > 0 then
    raise exception 'medicines.notes: % row(s) exceed 500 characters. Check: select id, notes from public.medicines where notes is not null and char_length(trim(notes)) > 500;', bad_count;
  end if;

  -- care_circles.name is being TIGHTENED from the existing 1..80 bound
  -- (supabase/care_circles.sql) to 1..60 — this is the constraint most likely
  -- to hit real existing data, since names between 61 and 80 characters were
  -- previously valid and accepted by the app.
  select count(*) into bad_count from public.care_circles
  where char_length(trim(name)) = 0 or char_length(trim(name)) > 60;
  if bad_count > 0 then
    raise exception 'care_circles.name: % row(s) are blank or exceed 60 characters (tightened from the existing 80-character limit). Check: select id, name from public.care_circles where char_length(trim(name)) = 0 or char_length(trim(name)) > 60;', bad_count;
  end if;

  select count(*) into bad_count from public.profiles
  where char_length(trim(full_name)) > 80;
  if bad_count > 0 then
    raise exception 'profiles.full_name: % row(s) exceed 80 characters. Check: select id, full_name from public.profiles where char_length(trim(full_name)) > 80;', bad_count;
  end if;

  -- personalized_audio_label: added by supabase/medicine_personalized_audio.sql,
  -- itself not yet applied as of this writing, so there is currently zero risk
  -- here — included for completeness in case that migration lands first.
  select count(*) into bad_count from public.medicine_schedules
  where personalized_audio_label is not null and char_length(trim(personalized_audio_label)) > 100;
  if bad_count > 0 then
    raise exception 'medicine_schedules.personalized_audio_label: % row(s) exceed 100 characters. Check: select id, personalized_audio_label from public.medicine_schedules where personalized_audio_label is not null and char_length(trim(personalized_audio_label)) > 100;', bad_count;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. medicines
-- ---------------------------------------------------------------------------
alter table public.medicines drop constraint if exists medicines_name_length_check;
alter table public.medicines
add constraint medicines_name_length_check
check (char_length(trim(name)) between 1 and 80);

alter table public.medicines drop constraint if exists medicines_dosage_value_length_check;
alter table public.medicines
add constraint medicines_dosage_value_length_check
check (dosage_value is null or char_length(trim(dosage_value)) <= 50);

alter table public.medicines drop constraint if exists medicines_dosage_unit_length_check;
alter table public.medicines
add constraint medicines_dosage_unit_length_check
check (dosage_unit is null or char_length(trim(dosage_unit)) <= 50);

alter table public.medicines drop constraint if exists medicines_instructions_length_check;
alter table public.medicines
add constraint medicines_instructions_length_check
check (instructions is null or char_length(trim(instructions)) <= 200);

alter table public.medicines drop constraint if exists medicines_notes_length_check;
alter table public.medicines
add constraint medicines_notes_length_check
check (notes is null or char_length(trim(notes)) <= 500);

-- ---------------------------------------------------------------------------
-- 2. care_circles — tightens the existing 1..80 bound to 1..60.
-- ---------------------------------------------------------------------------
-- `care_circles_name_check` is Postgres's default auto-generated name for the
-- original unnamed inline check in supabase/care_circles.sql; dropped
-- defensively in case it still exists under that name.
alter table public.care_circles drop constraint if exists care_circles_name_check;
alter table public.care_circles drop constraint if exists care_circles_name_length_check;
alter table public.care_circles
add constraint care_circles_name_length_check
check (char_length(trim(name)) between 1 and 60);

-- ---------------------------------------------------------------------------
-- 3. profiles — full_name has no non-blank requirement today (defaults to
--    '' — see handle_new_user() in supabase/schema.sql), so only an upper
--    bound is added; that existing behavior is preserved as-is.
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_full_name_length_check;
alter table public.profiles
add constraint profiles_full_name_length_check
check (char_length(trim(full_name)) <= 80);

-- ---------------------------------------------------------------------------
-- 4. medicine_schedules.personalized_audio_label (nullable)
-- ---------------------------------------------------------------------------
alter table public.medicine_schedules drop constraint if exists medicine_schedules_personalized_audio_label_length_check;
alter table public.medicine_schedules
add constraint medicine_schedules_personalized_audio_label_length_check
check (personalized_audio_label is null or char_length(trim(personalized_audio_label)) <= 100);

commit;
