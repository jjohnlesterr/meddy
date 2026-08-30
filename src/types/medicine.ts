export type ReminderSound = 'gentle_chime' | 'soft_bell' | 'morning_tone';

export type SnoozeMinutes = 5 | 10 | 15;

export type FrequencyType = 'daily' | 'weekdays' | 'custom';

/** 1 = Sunday … 7 = Saturday — matches expo-notifications' WEEKLY trigger `weekday` convention. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type MealTiming = 'before_food' | 'after_food' | 'with_food' | 'anytime';

/** How a personalized reminder clip was obtained. Distinct from `ReminderSound`, which is the required native alarm channel sound — personalized audio is never used as the OS notification sound (see AGENTS-facing docs in medicine-notifications.ts). */
export type PersonalizedAudioSource = 'recorded' | 'picked';

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
  /** Device-local file URI cache only — NOT synced across devices. `personalized_audio_storage_path` is the canonical, cross-device value. Never used as the native alarm sound — see PersonalizedAudioSource. */
  personalized_audio_uri: string | null;
  /** Supabase Storage object path in the private `personalized-reminder-audio` bucket — the source of truth for Care Circle sharing. */
  personalized_audio_storage_path: string | null;
  personalized_audio_duration_seconds: number | null;
  personalized_audio_created_by: string | null;
  personalized_audio_source: PersonalizedAudioSource | null;
  personalized_audio_label: string | null;
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
  /** Supabase Storage object path in the private `medicine-photos` bucket, e.g. `{medicineId}/photo.jpg` — null means no photo. */
  photo_storage_path: string | null;
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
  /** The selected schedule days (1=Sunday..7=Saturday). All 7 selected is stored as "daily"; exactly Mon–Fri is stored as "weekdays"; any other combination is "custom" — derived automatically at save time, there is no separate frequency-mode field. */
  daysOfWeek: Weekday[];
  mealTiming: MealTiming | null;
  /** Local, resized/compressed JPEG staged for upload — set when the user captures/picks/replaces a photo this session. Null means "no change staged". */
  photoLocalUri: string | null;
  /** Existing canonical photo path, carried over from a loaded medicine. Cleared to null by the user removing a saved photo (distinct from never having had one, which is also null — both cases mean "no photo should exist after save" when photoLocalUri is also null). */
  photoStoragePath: string | null;
  /** Optional personalized voice/audio reminder, synced via Supabase Storage so Care Circle members can play it. Never used as the native alarm sound. */
  personalizedAudioUri: string | null;
  personalizedAudioStoragePath: string | null;
  personalizedAudioDurationSeconds: number | null;
  personalizedAudioSource: PersonalizedAudioSource | null;
  personalizedAudioLabel: string | null;
  reminderSound: ReminderSound;
  vibrationEnabled: boolean;
  snoozeEnabled: boolean;
  snoozeMinutes: SnoozeMinutes;
  active: boolean;
};
