export type ReminderSound = 'gentle_chime' | 'soft_bell' | 'morning_tone';

export type SnoozeMinutes = 5 | 10 | 15;

export type MedicineSchedule = {
  id: string;
  medicine_id: string;
  user_id: string;
  time_of_day: string;
  frequency_type: string | null;
  days_of_week: number[] | null;
  meal_timing: string | null;
  start_date: string | null;
  end_date: string | null;
  reminder_sound: ReminderSound;
  vibration_enabled: boolean;
  snooze_enabled: boolean;
  snooze_minutes: SnoozeMinutes;
  active: boolean;
  created_at: string;
};

export type Medicine = {
  id: string;
  user_id: string;
  care_circle_id: string | null;
  name: string;
  dosage_value: string | null;
  dosage_unit: string | null;
  form: string | null;
  instructions: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  schedules: MedicineSchedule[];
};

export type MedicineInput = {
  name: string;
  dosageValue: string;
  dosageUnit: string;
  form: string;
  instructions: string;
  notes: string;
  timeOfDay: string;
  reminderSound: ReminderSound;
  vibrationEnabled: boolean;
  snoozeEnabled: boolean;
  snoozeMinutes: SnoozeMinutes;
  active: boolean;
};
