import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { MeddyButton } from '@/components/meddy-button';
import { MeddyMascot } from '@/components/meddy-mascot';
import { MedicineCard } from '@/components/medicine-card';
import { NotificationBell } from '@/components/notification-bell';
import { ScreenShell, sharedStyles } from '@/components/screen-shell';
import { Palette } from '@/constants/theme';
import { useMedicines } from '@/context/medicine-context';

export default function MedicinesScreen() {
  const router = useRouter();
  const { medicines, isLoading, error, refreshMedicines } = useMedicines();

  return (
    <ScreenShell title="My Medicines" subtitle="Your medicines and daily schedules." rightAction={<NotificationBell />}>
      {isLoading ? (
        <View style={[sharedStyles.card, styles.stateCard]}>
          <ActivityIndicator color={Palette.strongPink} size="large" />
          <Text style={styles.stateText}>Loading medicines…</Text>
        </View>
      ) : error ? (
        <View style={[sharedStyles.card, styles.stateCard]}>
          <Text accessibilityRole="alert" style={styles.error}>We could not load your medicines.</Text>
          <Text style={styles.stateText}>{error}</Text>
          <MeddyButton label="Try Again" onPress={() => void refreshMedicines()} variant="secondary" style={styles.retry} />
        </View>
      ) : medicines.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.mascotStage}><MeddyMascot state="medicine" style={styles.mascot} /></View>
          <Text style={styles.emptyTitle}>No medicines yet</Text>
          <Text style={styles.emptyText}>Add your first medicine and schedule.</Text>
          <MeddyButton label="+ Add Medicine" onPress={() => router.push('/medicine/add' as Href)} style={styles.emptyButton} />
        </View>
      ) : (
        <>
          <MeddyButton
            label="+ Add Medicine"
            onPress={() => router.push('/medicine/add' as Href)}
            variant="secondary"
            style={styles.addButton}
          />
          <View style={styles.list}>
            {medicines.map((medicine) => (
              <MedicineCard
                key={medicine.id}
                medicine={medicine}
                onPress={() => router.push(`/medicine/${medicine.id}` as Href)}
              />
            ))}
          </View>
        </>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  stateCard: { alignItems: 'center', gap: 12 },
  stateText: { color: Palette.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  error: { color: Palette.danger, fontSize: 17, lineHeight: 23, fontWeight: '800', textAlign: 'center' },
  retry: { minHeight: 50, marginTop: 4 },
  emptyCard: { alignItems: 'center', backgroundColor: Palette.softPink, borderWidth: 1, borderColor: Palette.border, borderRadius: 28, padding: 22 },
  mascotStage: { height: 190, width: '100%', alignItems: 'center', justifyContent: 'center' },
  mascot: { width: 180, height: 205 },
  emptyTitle: { color: Palette.text, fontSize: 23, lineHeight: 30, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: Palette.textSecondary, fontSize: 16, lineHeight: 23, textAlign: 'center', marginTop: 7 },
  emptyButton: { alignSelf: 'stretch', marginTop: 20 },
  addButton: { alignSelf: 'flex-end', minHeight: 48, borderRadius: 16, paddingHorizontal: 16 },
  list: { gap: 12, marginTop: 16 },
});
