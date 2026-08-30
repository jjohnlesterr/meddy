import { deleteMedicinePhoto, uploadMedicinePhoto } from '@/lib/medicine-photo-storage';
import { executeSupabaseRequest, supabase, supabaseConfigurationError } from '@/lib/supabase';
import type { FrequencyType, Medicine, MedicineInput, MedicineSchedule, SnoozeMinutes } from '@/types/medicine';

const WEEKDAY_DAYS = [2, 3, 4, 5, 6]; // Mon–Fri, 1=Sunday..7=Saturday convention
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

// There is no separate frequency-mode UI — the user only picks days. The mode
// is derived from exactly which days are selected: all 7 => "daily" (stored
// as days_of_week: null, matching the original "every day" representation),
// exactly Mon–Fri => "weekdays", anything else => "custom".
function resolveScheduleDays(input: MedicineInput): { frequency_type: FrequencyType; days_of_week: number[] | null } {
  const days = [...new Set(input.daysOfWeek)].filter((day) => day >= 1 && day <= 7).sort((a, b) => a - b);
  if (days.length === 0) throw new Error('Select at least one day.');
  if (days.length === ALL_DAYS.length) return { frequency_type: 'daily', days_of_week: null };
  if (days.length === WEEKDAY_DAYS.length && days.every((day, index) => day === WEEKDAY_DAYS[index])) {
    return { frequency_type: 'weekdays', days_of_week: days };
  }
  return { frequency_type: 'custom', days_of_week: days };
}

type OptionalScheduleColumns =
  | 'reminder_sound'
  | 'vibration_enabled'
  | 'snooze_enabled'
  | 'snooze_minutes'
  | 'personalized_audio_uri'
  | 'personalized_audio_source'
  | 'personalized_audio_label'
  | 'personalized_audio_storage_path'
  | 'personalized_audio_duration_seconds'
  | 'personalized_audio_created_by';

type OptionalMedicineColumns = 'photo_storage_path';

type MedicineRow = Omit<Medicine, 'schedules' | OptionalMedicineColumns> &
  Partial<Pick<Medicine, OptionalMedicineColumns>>;
type MedicineScheduleRow = Omit<MedicineSchedule, OptionalScheduleColumns> &
  Partial<Pick<MedicineSchedule, OptionalScheduleColumns>>;
type MedicineWithSchedulesRow = MedicineRow & {
  medicine_schedules: MedicineScheduleRow[] | null;
};

const scheduleCoreColumns = `
    id,
    medicine_id,
    user_id,
    time_of_day,
    frequency_type,
    days_of_week,
    meal_timing,
    start_date,
    end_date,
    active,
    created_at
`;

const scheduleReminderSettingsColumns = `
    reminder_sound,
    vibration_enabled,
    snooze_enabled,
    snooze_minutes
`;

// From supabase/medicine_personalized_audio.sql.
const schedulePersonalizedAudioColumns = `
    personalized_audio_uri,
    personalized_audio_source,
    personalized_audio_label
`;

// From supabase/medicine_personalized_audio_storage.sql (run after the file above).
const schedulePersonalizedAudioStorageColumns = `
    personalized_audio_storage_path,
    personalized_audio_duration_seconds,
    personalized_audio_created_by
`;

function medicineSelectFor(scheduleColumns: string, includePhoto: boolean) {
  return `
  id,
  user_id,
  care_circle_id,
  name,
  dosage_value,
  dosage_unit,
  form,
  instructions,
  notes,
  ${includePhoto ? 'photo_storage_path,' : ''}
  active,
  created_at,
  updated_at,
  medicine_schedules (
    ${scheduleColumns}
  )
`;
}

// Ordered from most to least complete. Each tier is a strict column subset of
// the one before it, so on a 42703 "column does not exist" error we can just
// step down to the next tier without needing to parse which exact column was
// missing — this keeps reads (and, via writeScheduleWithPersonalizedAudioFallback,
// writes) working no matter which of the personalized-audio migrations
// (supabase/medicine_personalized_audio.sql,
// supabase/medicine_personalized_audio_storage.sql) or the photo migration
// (supabase/medicine_photos.sql) have been run yet. The photo column is only
// ever requested in the single topmost tier — if it's missing, everything
// else in the row is still requested via the existing (unaffected) tiers.
const medicineSelectTiers = [
  medicineSelectFor(`${scheduleCoreColumns},${scheduleReminderSettingsColumns},${schedulePersonalizedAudioColumns},${schedulePersonalizedAudioStorageColumns}`, true),
  medicineSelectFor(`${scheduleCoreColumns},${scheduleReminderSettingsColumns},${schedulePersonalizedAudioColumns},${schedulePersonalizedAudioStorageColumns}`, false),
  medicineSelectFor(`${scheduleCoreColumns},${scheduleReminderSettingsColumns},${schedulePersonalizedAudioColumns}`, false),
  medicineSelectFor(`${scheduleCoreColumns},${scheduleReminderSettingsColumns}`, false),
  medicineSelectFor(scheduleCoreColumns, false),
];

function getSupabase() {
  if (!supabase) {
    throw new Error(supabaseConfigurationError ?? 'Supabase is not configured.');
  }
  return supabase;
}

function normalizeSnoozeMinutes(value: number | undefined): SnoozeMinutes {
  return value === 5 || value === 10 || value === 15 ? value : 10;
}

function mapSchedule(schedule: MedicineScheduleRow): MedicineSchedule {
  return {
    ...schedule,
    reminder_sound: schedule.reminder_sound ?? 'gentle_chime',
    vibration_enabled: schedule.vibration_enabled ?? true,
    snooze_enabled: schedule.snooze_enabled ?? true,
    snooze_minutes: normalizeSnoozeMinutes(schedule.snooze_minutes),
    personalized_audio_uri: schedule.personalized_audio_uri ?? null,
    personalized_audio_source: schedule.personalized_audio_source ?? null,
    personalized_audio_label: schedule.personalized_audio_label ?? null,
    personalized_audio_storage_path: schedule.personalized_audio_storage_path ?? null,
    personalized_audio_duration_seconds: schedule.personalized_audio_duration_seconds ?? null,
    personalized_audio_created_by: schedule.personalized_audio_created_by ?? null,
  };
}

function mapMedicine(row: MedicineWithSchedulesRow): Medicine {
  const { medicine_schedules, ...medicine } = row;
  return {
    ...medicine,
    photo_storage_path: medicine.photo_storage_path ?? null,
    schedules: (medicine_schedules ?? [])
      .map(mapSchedule)
      .sort((a, b) => a.time_of_day.localeCompare(b.time_of_day)),
  };
}

function isMissingColumnError(error: { code?: string; message?: string } | null) {
  return error?.code === '42703';
}

export async function fetchMedicines(userId: string): Promise<Medicine[]> {
  const client = getSupabase();
  const runSelect = (select: string) =>
    executeSupabaseRequest(() =>
      client
        .from('medicines')
        .select(select)
        .or(`user_id.eq.${userId},care_circle_id.not.is.null`)
        .order('created_at', { ascending: false }),
    );

  let result = await runSelect(medicineSelectTiers[0]);
  let tier = 0;
  while (isMissingColumnError(result.error) && tier < medicineSelectTiers.length - 1) {
    if (__DEV__) {
      console.warn('[Meddy medicines] Some schedule columns are missing; falling back to an earlier schema tier.', {
        code: result.error?.code,
        message: result.error?.message,
        migrations: ['supabase/medicine_reminder_settings.sql', 'supabase/medicine_personalized_audio.sql', 'supabase/medicine_personalized_audio_storage.sql'],
      });
    }
    tier += 1;
    result = await runSelect(medicineSelectTiers[tier]);
  }

  if (result.error) throw result.error;
  const data = result.data as unknown as MedicineWithSchedulesRow[] | null;
  return (data ?? []).map(mapMedicine);
}

/** 0 = full payload (incl. storage columns), 1 = core personalized-audio columns only, 2 = none. */
type PersonalizedAudioWriteTier = 0 | 1 | 2;

function personalizedAudioFields(userId: string, input: MedicineInput, tier: PersonalizedAudioWriteTier) {
  if (tier === 2) return {};
  const core = {
    personalized_audio_uri: input.personalizedAudioUri,
    personalized_audio_source: input.personalizedAudioSource,
    personalized_audio_label: input.personalizedAudioLabel,
  };
  if (tier === 1) return core;
  return {
    ...core,
    personalized_audio_storage_path: input.personalizedAudioStoragePath,
    personalized_audio_duration_seconds: input.personalizedAudioDurationSeconds,
    personalized_audio_created_by: input.personalizedAudioStoragePath ? userId : null,
  };
}

/** Retries a schedule insert/update against progressively smaller personalized-audio column sets if the relevant migration (supabase/medicine_personalized_audio.sql, then supabase/medicine_personalized_audio_storage.sql) has not been run yet, so saving a medicine never breaks on those optional columns. */
async function writeScheduleWithPersonalizedAudioFallback(
  run: (tier: PersonalizedAudioWriteTier) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>,
) {
  let tier: PersonalizedAudioWriteTier = 0;
  let result = await executeSupabaseRequest(() => run(tier));
  while (isMissingColumnError(result.error) && tier < 2) {
    if (__DEV__) {
      console.warn('[Meddy medicines] Some personalized-audio columns are missing; saving with a smaller column set.', {
        code: result.error?.code,
        message: result.error?.message,
        migrations: ['supabase/medicine_personalized_audio.sql', 'supabase/medicine_personalized_audio_storage.sql'],
      });
    }
    tier = (tier + 1) as PersonalizedAudioWriteTier;
    result = await executeSupabaseRequest(() => run(tier));
  }
  return result;
}

/**
 * Uploads/removes the medicine's photo (if the form staged a change) and
 * best-effort persists the resulting path on the medicine row. Runs after
 * the medicine already exists, since the deterministic storage path
 * (`{medicineId}/photo.jpg`) needs a real medicine id. If
 * supabase/medicine_photos.sql hasn't been applied yet, the column write
 * 42703s and is swallowed (same graceful-degradation pattern as the
 * personalized-audio columns) — the photo still uploads to Storage, it just
 * won't be linked/visible until the migration is applied and the medicine is
 * saved again.
 */
async function applyMedicinePhoto(
  client: ReturnType<typeof getSupabase>,
  medicineId: string,
  input: Pick<MedicineInput, 'photoLocalUri' | 'photoStoragePath'>,
): Promise<string | null> {
  async function setColumn(path: string | null) {
    const { error } = await executeSupabaseRequest(() =>
      client.from('medicines').update({ photo_storage_path: path }).eq('id', medicineId).select('id').single(),
    );
    if (error && !isMissingColumnError(error)) throw error;
    if (error && __DEV__) {
      console.warn('[Meddy medicines] photo_storage_path column is missing; the photo uploaded but is not linked yet.', {
        migration: 'supabase/medicine_photos.sql',
      });
    }
  }

  if (input.photoLocalUri) {
    const path = await uploadMedicinePhoto(medicineId, input.photoLocalUri);
    await setColumn(path);
    return path;
  }

  if (!input.photoStoragePath) {
    await deleteMedicinePhoto(medicineId);
    await setColumn(null);
    return null;
  }

  return input.photoStoragePath;
}

export async function createMedicine(userId: string, input: MedicineInput, careCircleId: string | null = null): Promise<Medicine> {
  const client = getSupabase();
  const { data: medicine, error: medicineError } = await executeSupabaseRequest(() =>
    client
      .from('medicines')
      .insert({
        user_id: userId,
        care_circle_id: careCircleId,
        name: input.name.trim(),
        dosage_value: input.dosageValue.trim(),
        dosage_unit: input.dosageUnit.trim(),
        form: input.form,
        instructions: input.instructions.trim(),
        notes: input.notes.trim() || null,
        active: input.active,
      })
      .select('*')
      .single(),
  );

  if (medicineError) throw medicineError;

  const { data: schedule, error: scheduleError } = await writeScheduleWithPersonalizedAudioFallback((tier) =>
    client
      .from('medicine_schedules')
      .insert({
        medicine_id: medicine.id,
        user_id: userId,
        time_of_day: `${input.timeOfDay}:00`,
        ...resolveScheduleDays(input),
        meal_timing: input.mealTiming,
        ...personalizedAudioFields(userId, input, tier),
        reminder_sound: input.reminderSound,
        vibration_enabled: input.vibrationEnabled,
        snooze_enabled: input.snoozeEnabled,
        snooze_minutes: input.snoozeMinutes,
        active: input.active,
      })
      .select('*')
      .single(),
  );

  if (scheduleError) {
    await executeSupabaseRequest(() =>
      client.from('medicines').delete().eq('id', medicine.id),
    );
    throw scheduleError;
  }

  const photoStoragePath = await applyMedicinePhoto(client, medicine.id, input);

  return { ...(medicine as MedicineRow), photo_storage_path: photoStoragePath, schedules: [schedule as MedicineSchedule] };
}

export async function updateMedicine(
  medicineId: string,
  userId: string,
  scheduleId: string | undefined,
  input: MedicineInput,
): Promise<Medicine> {
  const client = getSupabase();
  const { data: medicine, error: medicineError } = await executeSupabaseRequest(() =>
    client
      .from('medicines')
      .update({
        name: input.name.trim(),
        dosage_value: input.dosageValue.trim(),
        dosage_unit: input.dosageUnit.trim(),
        form: input.form,
        instructions: input.instructions.trim(),
        notes: input.notes.trim() || null,
        active: input.active,
      })
      .eq('id', medicineId)
      .select('*')
      .single(),
  );

  if (medicineError) throw medicineError;

  function scheduleValues(tier: PersonalizedAudioWriteTier) {
    return {
      time_of_day: `${input.timeOfDay}:00`,
      ...resolveScheduleDays(input),
      meal_timing: input.mealTiming,
      ...personalizedAudioFields(userId, input, tier),
      reminder_sound: input.reminderSound,
      vibration_enabled: input.vibrationEnabled,
      snooze_enabled: input.snoozeEnabled,
      snooze_minutes: input.snoozeMinutes,
      active: input.active,
    };
  }

  const { data: schedule, error: scheduleError } = await writeScheduleWithPersonalizedAudioFallback((tier) => {
    const values = scheduleValues(tier);
    const scheduleQuery = scheduleId
      ? client
          .from('medicine_schedules')
          .update(values)
          .eq('id', scheduleId)
          .eq('medicine_id', medicineId)
      : client.from('medicine_schedules').insert({ ...values, medicine_id: medicineId, user_id: userId });

    return scheduleQuery.select('*').single();
  });
  if (scheduleError) throw scheduleError;

  const photoStoragePath = await applyMedicinePhoto(client, medicineId, input);

  return { ...(medicine as MedicineRow), photo_storage_path: photoStoragePath, schedules: [schedule as MedicineSchedule] };
}

export async function deleteMedicine(medicineId: string, _userId: string): Promise<void> {
  const client = getSupabase();
  const { error } = await executeSupabaseRequest(() =>
    client.from('medicines').delete().eq('id', medicineId).select('id').single(),
  );

  if (error) throw error;
  await deleteMedicinePhoto(medicineId);
}

export function formatMedicineTime(timeOfDay?: string) {
  if (!timeOfDay) return 'No schedule';
  const [hours = '0', minutes = '0'] = timeOfDay.split(':');
  const date = new Date(2000, 0, 1, Number(hours), Number(minutes));
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const WEEKDAY_SHORT_LABELS: Record<number, string> = { 1: 'Sun', 2: 'Mon', 3: 'Tue', 4: 'Wed', 5: 'Thu', 6: 'Fri', 7: 'Sat' };
const WEEKDAY_ORDER = [2, 3, 4, 5, 6, 7, 1]; // display Monday-first

/** "Daily", "Weekdays", or "Mon, Wed, Fri" — for the custom day subset. */
export function formatScheduleDays(schedule?: Pick<MedicineSchedule, 'frequency_type' | 'days_of_week'>): string {
  if (!schedule) return 'Daily';
  if (schedule.frequency_type === 'weekdays') return 'Weekdays';
  if (schedule.frequency_type === 'custom' && schedule.days_of_week?.length) {
    const selected = new Set(schedule.days_of_week);
    return WEEKDAY_ORDER.filter((day) => selected.has(day))
      .map((day) => WEEKDAY_SHORT_LABELS[day])
      .join(', ');
  }
  return 'Daily';
}

/** "Daily · 8:00 AM", "Mon, Wed, Fri · 8:00 AM", "Weekdays · 7:30 AM" */
export function formatScheduleSummary(schedule?: MedicineSchedule): string {
  return `${formatScheduleDays(schedule)} · ${formatMedicineTime(schedule?.time_of_day)}`;
}

export function medicineDosageLabel(medicine: Medicine) {
  return [medicine.dosage_value, medicine.dosage_unit].filter(Boolean).join(' ');
}

function minutesUntil(timeOfDay?: string) {
  if (!timeOfDay) return Number.POSITIVE_INFINITY;
  const [hours = 0, minutes = 0] = timeOfDay.split(':').map(Number);
  const now = new Date();
  const scheduled = hours * 60 + minutes;
  const current = now.getHours() * 60 + now.getMinutes();
  return (scheduled - current + 24 * 60) % (24 * 60);
}

export function sortMedicinesByNextSchedule(medicines: Medicine[]) {
  return [...medicines].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return minutesUntil(a.schedules[0]?.time_of_day) - minutesUntil(b.schedules[0]?.time_of_day);
  });
}
