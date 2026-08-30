import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { MeddyButton } from '@/components/meddy-button';
import { MedicineForm } from '@/components/medicine-form';
import { ScreenShell, sharedStyles } from '@/components/screen-shell';
import { Palette } from '@/constants/theme';
import { FontFamily } from '@/constants/typography';
import { useCareCircles } from '@/context/care-circle-context';
import { useMedicines } from '@/context/medicine-context';
import { friendlySupabaseErrorMessage } from '@/lib/supabase';
import type { MealTiming, Medicine, MedicineInput, PersonalizedAudioSource, Weekday } from '@/types/medicine';

const ALL_DAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

function messageFromError(error: unknown) {
  return friendlySupabaseErrorMessage(error, 'We could not update this medicine. Please try again.');
}

// "daily" is stored with days_of_week: null (see resolveScheduleDays in lib/medicines.ts) — reload that as all 7 days selected so the chips accurately reflect what's saved.
function daysOfWeekFromSchedule(schedule: Medicine['schedules'][number] | undefined): Weekday[] {
  const stored = (schedule?.days_of_week ?? []).filter((day): day is Weekday => day >= 1 && day <= 7);
  return stored.length > 0 ? stored : ALL_DAYS;
}

function valuesFromMedicine(medicine: Medicine): MedicineInput {
  const schedule = medicine.schedules[0];
  return {
    name: medicine.name,
    dosageValue: medicine.dosage_value ?? '',
    dosageUnit: medicine.dosage_unit ?? '',
    form: medicine.form ?? '',
    instructions: medicine.instructions ?? '',
    notes: medicine.notes ?? '',
    photoLocalUri: null,
    photoStoragePath: medicine.photo_storage_path ?? null,
    timeOfDay: schedule?.time_of_day.slice(0, 5) ?? '',
    daysOfWeek: daysOfWeekFromSchedule(schedule),
    mealTiming: (schedule?.meal_timing as MealTiming | null) ?? null,
    personalizedAudioUri: schedule?.personalized_audio_uri ?? null,
    personalizedAudioStoragePath: schedule?.personalized_audio_storage_path ?? null,
    personalizedAudioDurationSeconds: schedule?.personalized_audio_duration_seconds ?? null,
    personalizedAudioSource: (schedule?.personalized_audio_source as PersonalizedAudioSource | null) ?? null,
    personalizedAudioLabel: schedule?.personalized_audio_label ?? null,
    reminderSound: schedule?.reminder_sound ?? 'gentle_chime',
    vibrationEnabled: schedule?.vibration_enabled ?? true,
    snoozeEnabled: schedule?.snooze_enabled ?? true,
    snoozeMinutes: schedule?.snooze_minutes ?? 10,
    active: medicine.active,
  };
}

export default function EditMedicineScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const medicineId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { allMedicines, isLoading, error: loadError, refreshMedicines, updateMedicine } = useMedicines();
  const { circles, isLoading: circlesLoading } = useCareCircles();
  const medicine = allMedicines.find((item) => item.id === medicineId);
  const circle = circles.find((item) => item.id === medicine?.care_circle_id);
  const canEdit = medicine?.care_circle_id === null || circle?.role === 'owner' || circle?.role === 'admin' || circle?.role === 'caregiver';
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  async function saveMedicine(values: MedicineInput) {
    if (!medicineId) return;
    setSaveError('');
    setIsSaving(true);
    try {
      await updateMedicine(medicineId, values);
      router.replace(`/medicine/${medicineId}?saved=updated` as Href);
    } catch (error) {
      setSaveError(messageFromError(error));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading || (medicine?.care_circle_id && circlesLoading)) {
    return (
      <ScreenShell title="Edit Medicine" onBack={() => router.back()}>
        <View style={[sharedStyles.card, styles.centered]}>
          <ActivityIndicator color={Palette.strongPink} size="large" />
          <Text style={styles.message}>Loading medicine…</Text>
        </View>
      </ScreenShell>
    );
  }

  if (!medicine) {
    return (
      <ScreenShell title="Medicine unavailable" onBack={() => router.back()}>
        <View style={[sharedStyles.card, styles.centered]}>
          <Text style={styles.error}>{loadError ?? 'This medicine could not be found.'}</Text>
          <MeddyButton label="Try Again" onPress={() => void refreshMedicines()} variant="secondary" style={styles.retry} />
        </View>
      </ScreenShell>
    );
  }

  if (!canEdit) {
    return (
      <ScreenShell title="Edit Medicine" onBack={() => router.back()}>
        <View style={[sharedStyles.card, styles.centered]}>
          <Text accessibilityRole="alert" style={styles.error}>Your Care Circle role does not allow editing this medicine.</Text>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      keyboardSafe
      title="Edit Medicine"
      subtitle={medicine.name}
      onBack={() => router.back()}>
      {circle ? <View style={styles.circleContext}><Text style={styles.circleContextLabel}>CARE CIRCLE</Text><Text style={styles.circleContextName}>{circle.name}</Text></View> : null}
      <MedicineForm
        initialValues={valuesFromMedicine(medicine)}
        submitLabel="Save Changes"
        isSaving={isSaving}
        submitError={saveError}
        showActive
        onSubmit={saveMedicine}
        onCancel={() => router.back()}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', gap: 14 },
  message: { color: Palette.textSecondary, fontFamily: FontFamily.regular, fontSize: 16 },
  error: { color: Palette.danger, fontFamily: FontFamily.bold, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  retry: { minHeight: 50 },
  circleContext: { borderRadius: 18, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.softPink, paddingHorizontal: 16, paddingVertical: 13, marginBottom: 20 },
  circleContextLabel: { color: Palette.textSecondary, fontFamily: FontFamily.extraBold, fontSize: 11, letterSpacing: 0.8 },
  circleContextName: { color: Palette.text, fontFamily: FontFamily.extraBold, fontSize: 17, lineHeight: 23, marginTop: 3 },
});
