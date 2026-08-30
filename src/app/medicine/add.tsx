import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Modal, StyleSheet, Text, View } from 'react-native';

import { MeddyButton } from '@/components/meddy-button';
import { MeddyMascot } from '@/components/meddy-mascot';
import { MedicineForm } from '@/components/medicine-form';
import { ScreenShell, sharedStyles } from '@/components/screen-shell';
import { Palette } from '@/constants/theme';
import { FontFamily } from '@/constants/typography';
import { useCareCircles } from '@/context/care-circle-context';
import { useMedicines } from '@/context/medicine-context';
import { friendlySupabaseErrorMessage } from '@/lib/supabase';
import type { Medicine, MedicineInput } from '@/types/medicine';

function messageFromError(error: unknown) {
  return friendlySupabaseErrorMessage(error, 'We could not save this medicine. Please try again.');
}

export default function AddMedicineScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ careCircleId?: string | string[] }>();
  const careCircleId = Array.isArray(params.careCircleId) ? params.careCircleId[0] : params.careCircleId;
  const { circles, isLoading: circlesLoading } = useCareCircles();
  const { createMedicine } = useMedicines();
  const circle = circles.find((item) => item.id === careCircleId);
  const canAddToCircle = circle?.role === 'owner' || circle?.role === 'admin' || circle?.role === 'caregiver';
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMedicine, setSavedMedicine] = useState<Medicine | null>(null);
  const savingRef = useRef(false);

  async function saveMedicine(values: MedicineInput) {
    if (savingRef.current) return;
    savingRef.current = true;
    setError('');
    setIsSaving(true);
    try {
      const medicine = await createMedicine(values, careCircleId ?? null);
      Keyboard.dismiss();
      setSavedMedicine(medicine);
    } catch (saveError) {
      setError(messageFromError(saveError));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  function finish() {
    setSavedMedicine(null);
    router.back();
  }

  function viewMedicine() {
    if (!savedMedicine) return;
    const medicineId = savedMedicine.id;
    setSavedMedicine(null);
    router.replace(`/medicine/${medicineId}` as Href);
  }

  if (careCircleId && circlesLoading) {
    return (
      <ScreenShell title="Add Medicine" onBack={() => router.back()}>
        <View style={[sharedStyles.card, styles.loadingCard]}><ActivityIndicator color={Palette.strongPink} size="large" /><Text style={styles.loadingText}>Loading Care Circle…</Text></View>
      </ScreenShell>
    );
  }

  if (careCircleId && (!circle || !canAddToCircle)) {
    return (
      <ScreenShell title="Add Medicine" onBack={() => router.back()}>
        <View style={[sharedStyles.card, styles.loadingCard]}><Text accessibilityRole="alert" style={styles.unavailableTitle}>Medicine access unavailable</Text><Text style={styles.loadingText}>Your Care Circle role does not allow adding medicines.</Text></View>
      </ScreenShell>
    );
  }

  return (
    <>
      <ScreenShell
        keyboardSafe
        title="Add Medicine"
        subtitle="Add one daily time for this medicine."
        onBack={() => router.back()}>
        {circle ? (
          <View style={styles.circleContext}>
            <Text style={styles.circleContextLabel}>ADDING MEDICINE TO</Text>
            <Text style={styles.circleContextName}>{circle.name}</Text>
          </View>
        ) : null}
        <MedicineForm
          submitLabel="Save Medicine"
          isSaving={isSaving}
          submitError={error}
          onSubmit={saveMedicine}
          onCancel={() => router.back()}
        />
      </ScreenShell>

      <Modal transparent animationType="fade" visible={savedMedicine !== null} onRequestClose={finish}>
        <View style={styles.backdrop}>
          <View accessibilityViewIsModal style={styles.modalCard}>
            <MeddyMascot state="success" style={styles.mascot} />
            <Text accessibilityRole="header" style={styles.title}>Medicine saved!</Text>
            <Text style={styles.message}>{savedMedicine?.name} has been added to your schedule.</Text>
            <MeddyButton label="Done" onPress={finish} style={styles.doneButton} />
            <MeddyButton label="View Medicine" onPress={viewMedicine} variant="secondary" style={styles.viewButton} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  loadingCard: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: Palette.textSecondary, fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  unavailableTitle: { color: Palette.text, fontFamily: FontFamily.extraBold, fontSize: 18, lineHeight: 24, textAlign: 'center' },
  circleContext: { borderRadius: 18, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.softPink, paddingHorizontal: 16, paddingVertical: 13, marginBottom: 20 },
  circleContextLabel: { color: Palette.textSecondary, fontFamily: FontFamily.extraBold, fontSize: 11, lineHeight: 16, letterSpacing: 0.8 },
  circleContextName: { color: Palette.text, fontFamily: FontFamily.extraBold, fontSize: 17, lineHeight: 23, marginTop: 3 },
  backdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(43, 43, 43, 0.42)' },
  modalCard: { width: '100%', maxWidth: 440, alignSelf: 'center', alignItems: 'center', borderRadius: 28, backgroundColor: Palette.white, padding: 24 },
  mascot: { width: 150, height: 170 },
  title: { color: Palette.text, fontFamily: FontFamily.extraBold, fontSize: 25, lineHeight: 32, textAlign: 'center', marginTop: 4 },
  message: { color: Palette.textSecondary, fontFamily: FontFamily.regular, fontSize: 16, lineHeight: 24, textAlign: 'center', marginTop: 8 },
  doneButton: { alignSelf: 'stretch', marginTop: 24 },
  viewButton: { alignSelf: 'stretch', minHeight: 52, marginTop: 12 },
});
