import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { MeddyButton } from '@/components/meddy-button';
import { ScreenShell, sharedStyles } from '@/components/screen-shell';
import { Palette } from '@/constants/theme';
import { useCareCircles } from '@/context/care-circle-context';
import { useMedicines } from '@/context/medicine-context';
import { formatMedicineTime, medicineDosageLabel } from '@/lib/medicines';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : 'We could not delete this medicine. Please try again.';
}

export default function MedicineDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[]; saved?: string | string[] }>();
  const medicineId = Array.isArray(params.id) ? params.id[0] : params.id;
  const saved = Array.isArray(params.saved) ? params.saved[0] : params.saved;
  const { allMedicines, isLoading, error: loadError, refreshMedicines, deleteMedicine } = useMedicines();
  const { circles } = useCareCircles();
  const medicine = allMedicines.find((item) => item.id === medicineId);
  const circle = circles.find((item) => item.id === medicine?.care_circle_id);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  async function confirmDelete() {
    if (!medicineId) return;
    setDeleteError('');
    setIsDeleting(true);
    try {
      await deleteMedicine(medicineId);
      router.replace((medicine?.care_circle_id ? `/care/${medicine.care_circle_id}` : '/medicines') as Href);
    } catch (error) {
      setDeleteError(messageFromError(error));
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <ScreenShell title="Medicine" onBack={() => router.back()}>
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

  const schedule = medicine.schedules[0];
  const canEdit = medicine.care_circle_id === null || circle?.role === 'owner' || circle?.role === 'admin' || circle?.role === 'caregiver';
  const canDelete = medicine.care_circle_id === null || circle?.role === 'owner' || circle?.role === 'admin';
  const successMessage = saved === 'created'
    ? 'Medicine and schedule saved.'
    : saved === 'updated'
      ? 'Changes saved.'
      : null;

  return (
    <ScreenShell title={medicine.name} subtitle={circle ? `${circle.name} · Shared medicine` : 'Medicine details'} onBack={() => router.back()}>
      {successMessage ? <Text accessibilityRole="alert" style={styles.success}>{successMessage}</Text> : null}

      <View style={[sharedStyles.card, styles.summaryCard]}>
        <View style={styles.summaryHeading}>
          <View style={styles.summaryCopy}>
            <Text style={styles.dosage}>{medicineDosageLabel(medicine)}</Text>
            <Text style={styles.form}>{medicine.form}</Text>
          </View>
          <View style={[styles.status, !medicine.active && styles.inactiveStatus]}>
            <Text style={[styles.statusText, !medicine.active && styles.inactiveStatusText]}>{medicine.active ? 'Active' : 'Inactive'}</Text>
          </View>
        </View>
        <View style={styles.timeCard}>
          <Text style={styles.timeLabel}>Daily schedule</Text>
          <Text style={styles.time}>{formatMedicineTime(schedule?.time_of_day)}</Text>
        </View>
      </View>

      <Text style={sharedStyles.sectionTitle}>Information</Text>
      <View style={[sharedStyles.card, styles.detailsCard]}>
        <DetailRow label="Instructions" value={medicine.instructions || 'None'} />
        <DetailRow label="Notes" value={medicine.notes || 'None'} />
        <DetailRow label="Frequency" value={schedule?.frequency_type === 'daily' ? 'Every day' : schedule?.frequency_type || 'Not set'} />
      </View>

      {canEdit || canDelete ? <View style={styles.actions}>
        {canEdit ? <MeddyButton label="Edit" onPress={() => router.push(`/medicine/edit/${medicine.id}` as Href)} style={styles.actionButton} /> : null}
        {canDelete && !isConfirmingDelete ? (
          <MeddyButton label="Delete" onPress={() => setIsConfirmingDelete(true)} variant="danger" style={styles.actionButton} />
        ) : null}
      </View> : circle ? <Text style={styles.viewOnly}>View-only access</Text> : null}

      {isConfirmingDelete ? (
        <View style={[sharedStyles.card, styles.deleteCard]}>
          <Text style={styles.deleteTitle}>Delete this medicine?</Text>
          <Text style={styles.deleteText}>Its schedule will also be deleted. This cannot be undone.</Text>
          {deleteError ? <Text accessibilityRole="alert" style={styles.error}>{deleteError}</Text> : null}
          <View style={styles.deleteActions}>
            <MeddyButton label="Cancel" onPress={() => setIsConfirmingDelete(false)} disabled={isDeleting} variant="secondary" style={styles.actionButton} />
            <MeddyButton label={isDeleting ? 'Deleting…' : 'Confirm Delete'} onPress={() => void confirmDelete()} disabled={isDeleting} variant="danger" style={styles.actionButton} />
          </View>
        </View>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', gap: 14 },
  message: { color: Palette.textSecondary, fontSize: 16 },
  retry: { minHeight: 50 },
  success: { color: '#39764F', backgroundColor: '#EAF7EF', borderRadius: 16, paddingHorizontal: 15, paddingVertical: 12, fontSize: 14, lineHeight: 20, fontWeight: '800', marginBottom: 14 },
  summaryCard: { backgroundColor: Palette.softPink },
  summaryHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  summaryCopy: { flex: 1 },
  dosage: { color: Palette.text, fontSize: 21, lineHeight: 27, fontWeight: '800' },
  form: { color: Palette.textSecondary, fontSize: 15, lineHeight: 21, marginTop: 4 },
  status: { borderRadius: 999, backgroundColor: '#EAF7EF', paddingHorizontal: 11, paddingVertical: 6 },
  inactiveStatus: { backgroundColor: '#F3F0F1' },
  statusText: { color: '#3E8057', fontSize: 12, fontWeight: '800' },
  inactiveStatusText: { color: Palette.textSecondary },
  timeCard: { borderTopWidth: 1, borderTopColor: Palette.border, marginTop: 18, paddingTop: 16 },
  timeLabel: { color: Palette.textSecondary, fontSize: 13, fontWeight: '700' },
  time: { color: Palette.text, fontSize: 26, lineHeight: 33, fontWeight: '800', marginTop: 3 },
  detailsCard: { paddingVertical: 4 },
  detailRow: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: Palette.border },
  detailLabel: { color: Palette.textSecondary, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  detailValue: { color: Palette.text, fontSize: 16, lineHeight: 23, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  actionButton: { flex: 1, minHeight: 52 },
  viewOnly: { color: Palette.textSecondary, fontSize: 14, lineHeight: 20, fontWeight: '700', textAlign: 'center', marginTop: 24 },
  deleteCard: { marginTop: 16, borderColor: '#F3CACA' },
  deleteTitle: { color: Palette.text, fontSize: 19, lineHeight: 25, fontWeight: '800' },
  deleteText: { color: Palette.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 6 },
  deleteActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  error: { color: Palette.danger, fontSize: 14, lineHeight: 20, fontWeight: '700', marginTop: 12, textAlign: 'center' },
});
