import { executeSupabaseRequest, supabase, supabaseConfigurationError } from '@/lib/supabase';
import type { Medicine, MedicineInput, MedicineSchedule, SnoozeMinutes } from '@/types/medicine';

type MedicineRow = Omit<Medicine, 'schedules'>;
type MedicineScheduleRow = Omit<
  MedicineSchedule,
  'reminder_sound' | 'vibration_enabled' | 'snooze_enabled' | 'snooze_minutes'
> &
  Partial<
    Pick<MedicineSchedule, 'reminder_sound' | 'vibration_enabled' | 'snooze_enabled' | 'snooze_minutes'>
  >;
type MedicineWithSchedulesRow = MedicineRow & {
  medicine_schedules: MedicineScheduleRow[] | null;
};

const medicineSelect = `
  id,
  user_id,
  care_circle_id,
  name,
  dosage_value,
  dosage_unit,
  form,
  instructions,
  notes,
  active,
  created_at,
  updated_at,
  medicine_schedules (
    id,
    medicine_id,
    user_id,
    time_of_day,
    frequency_type,
    days_of_week,
    meal_timing,
    start_date,
    end_date,
    reminder_sound,
    vibration_enabled,
    snooze_enabled,
    snooze_minutes,
    active,
    created_at
  )
`;

// Keeps reads working while an existing project is waiting for the reminder
// settings migration. Writes still require that migration so preferences persist.
const medicineSelectWithoutReminderSettings = `
  id,
  user_id,
  care_circle_id,
  name,
  dosage_value,
  dosage_unit,
  form,
  instructions,
  notes,
  active,
  created_at,
  updated_at,
  medicine_schedules (
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
  )
`;

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
  };
}

function mapMedicine(row: MedicineWithSchedulesRow): Medicine {
  const { medicine_schedules, ...medicine } = row;
  return {
    ...medicine,
    schedules: (medicine_schedules ?? [])
      .map(mapSchedule)
      .sort((a, b) => a.time_of_day.localeCompare(b.time_of_day)),
  };
}

function isMissingReminderSettings(error: { code?: string; message?: string } | null) {
  return (
    error?.code === '42703' &&
    /medicine_schedules.*(reminder_sound|vibration_enabled|snooze_enabled|snooze_minutes)/.test(
      error.message ?? '',
    )
  );
}

export async function fetchMedicines(userId: string): Promise<Medicine[]> {
  const client = getSupabase();
  const result = await executeSupabaseRequest(() =>
    client
      .from('medicines')
      .select(medicineSelect)
      .or(`user_id.eq.${userId},care_circle_id.not.is.null`)
      .order('created_at', { ascending: false }),
  );
  let data = result.data as unknown as MedicineWithSchedulesRow[] | null;
  let error = result.error;

  if (isMissingReminderSettings(error)) {
    if (__DEV__) {
      console.warn('[Meddy medicines] Reminder columns are missing; using legacy schedule fields.', {
        code: error?.code,
        message: error?.message,
        migration: 'supabase/medicine_reminder_settings.sql',
      });
    }

    const legacyResult = await executeSupabaseRequest(() =>
      client
        .from('medicines')
        .select(medicineSelectWithoutReminderSettings)
        .or(`user_id.eq.${userId},care_circle_id.not.is.null`)
        .order('created_at', { ascending: false }),
    );

    data = legacyResult.data as unknown as MedicineWithSchedulesRow[] | null;
    error = legacyResult.error;
  }

  if (error) throw error;
  return (data ?? []).map(mapMedicine);
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

  const { data: schedule, error: scheduleError } = await executeSupabaseRequest(() =>
    client
      .from('medicine_schedules')
      .insert({
        medicine_id: medicine.id,
        user_id: userId,
        time_of_day: `${input.timeOfDay}:00`,
        frequency_type: 'daily',
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

  return { ...(medicine as MedicineRow), schedules: [schedule as MedicineSchedule] };
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

  const scheduleValues = {
    time_of_day: `${input.timeOfDay}:00`,
    frequency_type: 'daily',
    reminder_sound: input.reminderSound,
    vibration_enabled: input.vibrationEnabled,
    snooze_enabled: input.snoozeEnabled,
    snooze_minutes: input.snoozeMinutes,
    active: input.active,
  };

  const { data: schedule, error: scheduleError } = await executeSupabaseRequest(() => {
    const scheduleQuery = scheduleId
      ? client
          .from('medicine_schedules')
          .update(scheduleValues)
          .eq('id', scheduleId)
          .eq('medicine_id', medicineId)
      : client.from('medicine_schedules').insert({ ...scheduleValues, medicine_id: medicineId, user_id: userId });

    return scheduleQuery.select('*').single();
  });
  if (scheduleError) throw scheduleError;

  return { ...(medicine as MedicineRow), schedules: [schedule as MedicineSchedule] };
}

export async function deleteMedicine(medicineId: string, _userId: string): Promise<void> {
  const client = getSupabase();
  const { error } = await executeSupabaseRequest(() =>
    client.from('medicines').delete().eq('id', medicineId).select('id').single(),
  );

  if (error) throw error;
}

export function formatMedicineTime(timeOfDay?: string) {
  if (!timeOfDay) return 'No schedule';
  const [hours = '0', minutes = '0'] = timeOfDay.split(':');
  const date = new Date(2000, 0, 1, Number(hours), Number(minutes));
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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
