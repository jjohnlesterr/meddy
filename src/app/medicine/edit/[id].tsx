import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { MeddyButton } from '@/components/meddy-button';
import { MedicineForm } from '@/components/medicine-form';
import { ScreenShell, sharedStyles } from '@/components/screen-shell';
import { Palette } from '@/constants/theme';
import { useCareCircles } from '@/context/care-circle-context';
import { useMedicines } from '@/context/medicine-context';
import type { Medicine, MedicineInput } from '@/types/medicine';

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : 'We could not update this medicine. Please try again.';
}

function valuesFromMedicine(medicine: Medicine): MedicineInput {
  return {
    name: medicine.name,
    dosageValue: medicine.dosage_value ?? '',
    dosageUnit: medicine.dosage_unit ?? '',
    form: medicine.form ?? '',
    instructions: medicine.instructions ?? '',
    notes: medicine.notes ?? '',
    timeOfDay: medicine.schedules[0]?.time_of_day.slice(0, 5) ?? '',
    reminderSound: medicine.schedules[0]?.reminder_sound ?? 'gentle_chime',
    vibrationEnabled: medicine.schedules[0]?.vibration_enabled ?? true,
    snoozeEnabled: medicine.schedules[0]?.snooze_enabled ?? true,
    snoozeMinutes: medicine.schedules[0]?.snooze_minutes ?? 10,
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
  message: { color: Palette.textSecondary, fontSize: 16 },
  error: { color: Palette.danger, fontSize: 15, lineHeight: 22, textAlign: 'center', fontWeight: '700' },
  retry: { minHeight: 50 },
  circleContext: { borderRadius: 18, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.softPink, paddingHorizontal: 16, paddingVertical: 13, marginBottom: 20 },
  circleContextLabel: { color: Palette.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  circleContextName: { color: Palette.text, fontSize: 17, lineHeight: 23, fontWeight: '800', marginTop: 3 },
});
