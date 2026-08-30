import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { MeddyButton } from '@/components/meddy-button';
import { MedicineCard } from '@/components/medicine-card';
import { NotificationBell } from '@/components/notification-bell';
import { ScreenShell, sharedStyles } from '@/components/screen-shell';
import { Palette } from '@/constants/theme';
import { FontFamily } from '@/constants/typography';
import { useCareCircles } from '@/context/care-circle-context';
import { useMedicines } from '@/context/medicine-context';
import { formatMedicineTime } from '@/lib/medicines';
import type { CareCircleRole } from '@/types/care-circle';

const meddyBanner = require('@/assets/images/meddy/banner.png');

function roleLabel(role: CareCircleRole) {
  return role === 'family' ? 'Family Member' : `${role[0].toUpperCase()}${role.slice(1)}`;
}

export default function HomeScreen() {
  const router = useRouter();
  const { circles, isLoading: circlesLoading, error: circlesError, refreshCircles } = useCareCircles();
  const { allMedicines, medicines, isLoading: medicinesLoading, error: medicinesError, refreshMedicines } = useMedicines();
  const dashboardMedicines = medicines.slice(0, 3);
  const dashboardCircle = circles[0];
  const nextSharedMedicine = allMedicines.find((medicine) => medicine.care_circle_id === dashboardCircle?.id && medicine.active);

  return (
    <ScreenShell rightAction={<NotificationBell />}>
      <View style={[sharedStyles.card, styles.banner]}>
        <View style={styles.bannerCopy}>
          <Text style={styles.bannerTitle}>Stay on track</Text>
          <Text style={styles.bannerText}>Your medicines, made simple.</Text>
        </View>
        <Image accessibilityLabel="Meddy waving" resizeMode="contain" source={meddyBanner} style={styles.bannerImage} />
      </View>

      <View style={styles.medicineActionRow}>
        <MeddyButton
          label="+ Add Medicine"
          onPress={() => router.push('/medicine/add' as Href)}
          variant="secondary"
          style={styles.addButton}
        />
      </View>
      {medicinesLoading ? (
        <View style={[sharedStyles.card, styles.medicineState]}>
          <ActivityIndicator color={Palette.strongPink} />
          <Text style={styles.stateText}>Loading medicines…</Text>
        </View>
      ) : medicinesError ? (
        <View style={[sharedStyles.card, styles.medicineState]}>
          <Text accessibilityRole="alert" style={styles.stateError}>Medicines could not be loaded.</Text>
          <MeddyButton label="Try Again" onPress={() => void refreshMedicines()} variant="secondary" style={styles.retryButton} />
        </View>
      ) : medicines.length === 0 ? (
        <View style={[sharedStyles.card, styles.emptyCard]}>
          <Text style={styles.emptyTitle}>No medicines yet</Text>
          <Text style={styles.emptyText}>Add one to get started.</Text>
        </View>
      ) : (
        <View style={styles.medicineList}>
          {dashboardMedicines.map((medicine) => (
            <MedicineCard
              key={medicine.id}
              medicine={medicine}
              onPress={() => router.push(`/medicine/${medicine.id}` as Href)}
            />
          ))}
          {medicines.length > dashboardMedicines.length ? (
            <MeddyButton label="View All Medicines" onPress={() => router.push('/medicines' as Href)} variant="secondary" style={styles.viewAllButton} />
          ) : null}
        </View>
      )}

      <Text style={sharedStyles.sectionTitle}>Care Circle</Text>
      {circlesLoading ? (
        <View style={[sharedStyles.card, styles.circleState]}>
          <ActivityIndicator color={Palette.strongPink} />
          <Text style={styles.stateText}>Loading Care Circles…</Text>
        </View>
      ) : circlesError ? (
        <View style={[sharedStyles.card, styles.circleState]}>
          <Text accessibilityRole="alert" style={styles.stateError}>Care Circles could not be loaded.</Text>
          <MeddyButton label="Try Again" onPress={() => void refreshCircles()} variant="secondary" style={styles.retryButton} />
        </View>
      ) : dashboardCircle ? (
        <View style={[sharedStyles.card, styles.circleCard]}>
          <View style={styles.circleSummary}>
            <View style={styles.circleIcon}><Text style={styles.circleIconText}>♡</Text></View>
            <View style={styles.circleCopy}>
              <Text style={styles.circleTitle}>{dashboardCircle.name}</Text>
              <Text style={styles.circleMeta}>{roleLabel(dashboardCircle.role)} · {dashboardCircle.memberCount} {dashboardCircle.memberCount === 1 ? 'member' : 'members'}</Text>
              {nextSharedMedicine ? <Text style={styles.sharedMedicine}>Next: {nextSharedMedicine.name} · {formatMedicineTime(nextSharedMedicine.schedules[0]?.time_of_day)}</Text> : null}
              {circles.length > 1 ? <Text style={styles.moreCircles}>+ {circles.length - 1} more {circles.length === 2 ? 'circle' : 'circles'}</Text> : null}
            </View>
          </View>
          <MeddyButton
            label={circles.length > 1 ? 'View Care Circles' : 'Open Circle'}
            onPress={() => router.push((circles.length > 1 ? '/care-circle' : `/care/${dashboardCircle.id}`) as Href)}
            variant="secondary"
            style={styles.openButton}
          />
        </View>
      ) : (
        <View style={[sharedStyles.card, styles.emptyCard]}>
          <Text style={styles.emptyTitle}>No Care Circle yet</Text>
          <View style={styles.circleActions}>
            <MeddyButton label="Create Circle" onPress={() => router.push('/care/create' as Href)} style={styles.circleButton} />
            <MeddyButton label="Join with Code" onPress={() => router.push('/care/join' as Href)} variant="secondary" style={styles.circleButton} />
          </View>
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  banner: { height: 126, position: 'relative', overflow: 'hidden', padding: 0, backgroundColor: Palette.softPink },
  bannerImage: { position: 'absolute', right: 2, top: 0, width: '43%', height: '100%' },
  bannerCopy: { width: '59%', height: '100%', justifyContent: 'center', paddingLeft: 18, paddingRight: 8 },
  bannerTitle: { color: Palette.text, fontFamily: FontFamily.extraBold, fontSize: 19, lineHeight: 24 },
  bannerText: { color: Palette.textSecondary, fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20, marginTop: 5 },
  medicineActionRow: { minHeight: 44, alignItems: 'flex-end', justifyContent: 'center', marginTop: 20, marginBottom: 10 },
  addButton: { minHeight: 44, borderRadius: 15, backgroundColor: Palette.softPink, paddingHorizontal: 14 },
  medicineState: { minHeight: 92, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
  stateText: { color: Palette.textSecondary, fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20 },
  stateError: { color: Palette.danger, fontFamily: FontFamily.bold, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retryButton: { minHeight: 44, borderRadius: 15, paddingHorizontal: 14 },
  medicineList: { gap: 10 },
  viewAllButton: { minHeight: 46, borderRadius: 15 },
  emptyCard: { padding: 16 },
  emptyTitle: { color: Palette.text, fontFamily: FontFamily.extraBold, fontSize: 18, lineHeight: 24 },
  emptyText: { color: Palette.textSecondary, fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 23, marginTop: 6 },
  circleActions: { gap: 10, marginTop: 14 },
  circleButton: { minHeight: 52, borderRadius: 16 },
  circleState: { minHeight: 92, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
  circleCard: { padding: 18 },
  circleSummary: { flexDirection: 'row', alignItems: 'center' },
  circleIcon: { width: 48, height: 48, borderRadius: 18, backgroundColor: Palette.lightPink, alignItems: 'center', justifyContent: 'center' },
  circleIconText: { color: Palette.strongPink, fontFamily: FontFamily.regular, fontSize: 28 },
  circleCopy: { flex: 1, marginLeft: 13 },
  circleTitle: { color: Palette.text, fontFamily: FontFamily.extraBold, fontSize: 18, lineHeight: 24 },
  circleMeta: { color: Palette.textSecondary, fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 19, marginTop: 3 },
  sharedMedicine: { color: Palette.text, fontFamily: FontFamily.bold, fontSize: 13, lineHeight: 19, marginTop: 3 },
  moreCircles: { color: Palette.strongPink, fontFamily: FontFamily.bold, fontSize: 13, lineHeight: 19, marginTop: 3 },
  openButton: { alignSelf: 'flex-start', minHeight: 46, borderRadius: 15, marginTop: 16, paddingHorizontal: 16 },
});
