import type { Href } from 'expo-router';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { MeddyButton } from '@/components/meddy-button';
import { MeddyMascot } from '@/components/meddy-mascot';
import { NotificationBell } from '@/components/notification-bell';
import { ScreenShell, sharedStyles } from '@/components/screen-shell';
import { Palette } from '@/constants/theme';
import { useCareCircles } from '@/context/care-circle-context';
import { useMedicines } from '@/context/medicine-context';
import type { CareCircleRole, CareCircleSummary } from '@/types/care-circle';

function roleLabel(role: CareCircleRole) {
  return role === 'family' ? 'Family Member' : `${role[0].toUpperCase()}${role.slice(1)}`;
}

const CARE_CIRCLE_POLL_MS = 10000;

export default function CareCircleScreen() {
  const router = useRouter();
  const { circles, pendingRequests, isLoading, error, refreshCircles } = useCareCircles();
  const { refreshMedicines } = useMedicines();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refetch on every focus, then keep polling quietly while the tab stays open so
  // a request that gets accepted/rejected elsewhere lands here within a few
  // seconds without a re-login or leaving the screen. The medicine refresh also
  // re-syncs this device's local reminders for shared Care Circle medicines.
  useFocusEffect(
    useCallback(() => {
      void refreshCircles({ background: true });
      void refreshMedicines({ background: true });
      const interval = setInterval(() => {
        void refreshCircles({ background: true });
        void refreshMedicines({ background: true });
      }, CARE_CIRCLE_POLL_MS);
      return () => clearInterval(interval);
    }, [refreshCircles, refreshMedicines]),
  );

  const handlePullToRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refreshCircles({ background: true }), refreshMedicines({ background: true })]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshCircles, refreshMedicines]);

  return (
    <ScreenShell
      title="Care Circle"
      subtitle="Private groups for the people you trust."
      rightAction={<NotificationBell />}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handlePullToRefresh}
          tintColor={Palette.strongPink}
          colors={[Palette.strongPink]}
        />
      }>
      {isLoading ? (
        <View style={[sharedStyles.card, styles.stateCard]}>
          <ActivityIndicator color={Palette.strongPink} size="large" />
          <Text style={styles.stateText}>Loading Care Circles…</Text>
        </View>
      ) : error ? (
        <View style={[sharedStyles.card, styles.stateCard]}>
          <Text accessibilityRole="alert" style={styles.errorTitle}>Care Circles could not be loaded.</Text>
          <Text style={styles.stateText}>{error}</Text>
          <MeddyButton label="Try Again" onPress={() => void refreshCircles()} variant="secondary" style={styles.retryButton} />
        </View>
      ) : circles.length === 0 ? (
        <View style={styles.emptyCard}>
          <MeddyMascot state="careCircle" style={styles.emptyMascot} />
          <Text style={styles.emptyTitle}>No Care Circles yet</Text>
          <Text style={styles.emptyText}>Create one or join with an invite code.</Text>
          <View style={styles.emptyActions}>
            <MeddyButton label="Create Care Circle" onPress={() => router.push('/care/create' as Href)} />
            <MeddyButton label="Join with Code" onPress={() => router.push('/care/join' as Href)} variant="secondary" />
          </View>
        </View>
      ) : (
        <>
          <View style={styles.actionRow}>
            <MeddyButton label="+ Create Circle" onPress={() => router.push('/care/create' as Href)} variant="secondary" style={styles.actionButton} />
            <MeddyButton label="Join with Code" onPress={() => router.push('/care/join' as Href)} variant="secondary" style={styles.actionButton} />
          </View>
          <View style={styles.list}>
            {circles.map((circle) => (
              <CareCircleCard key={circle.id} circle={circle} onPress={() => router.push(`/care/${circle.id}` as Href)} />
            ))}
          </View>
        </>
      )}

      {pendingRequests.length > 0 ? (
        <>
          <Text style={sharedStyles.sectionTitle}>Pending requests</Text>
          <View style={styles.pendingList}>
            {pendingRequests.map((request) => (
              <View key={request.id} style={[sharedStyles.card, styles.pendingCard]}>
                <View style={styles.pendingIcon}><Text style={styles.pendingIconText}>✓</Text></View>
                <View style={styles.pendingCopy}>
                  <Text style={styles.pendingTitle}>{request.circleName}</Text>
                  <Text style={styles.pendingText}>Waiting for the owner’s approval</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </ScreenShell>
  );
}

function CareCircleCard({ circle, onPress }: { circle: CareCircleSummary; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={`${circle.name}, ${roleLabel(circle.role)}, ${circle.memberCount} members`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [sharedStyles.card, styles.circleCard, pressed && styles.pressed]}>
      <View style={styles.circleIcon}><Text style={styles.circleIconText}>♡</Text></View>
      <View style={styles.circleCopy}>
        <Text style={styles.circleName}>{circle.name}</Text>
        <Text style={styles.circleMeta}>{roleLabel(circle.role)} · {circle.memberCount} {circle.memberCount === 1 ? 'member' : 'members'}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stateCard: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 12 },
  stateText: { color: Palette.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  errorTitle: { color: Palette.danger, fontSize: 17, lineHeight: 23, fontWeight: '800', textAlign: 'center' },
  retryButton: { minHeight: 48, marginTop: 4 },
  emptyCard: { alignItems: 'center', backgroundColor: Palette.softPink, borderRadius: 30, borderWidth: 1, borderColor: Palette.border, padding: 24 },
  emptyMascot: { width: 205, height: 225 },
  emptyTitle: { color: Palette.text, fontSize: 23, lineHeight: 30, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  emptyText: { color: Palette.textSecondary, fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 8 },
  emptyActions: { alignSelf: 'stretch', gap: 11, marginTop: 22 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  actionButton: { flex: 1, minHeight: 50, borderRadius: 16, paddingHorizontal: 10 },
  list: { gap: 12 },
  circleCard: { minHeight: 88, flexDirection: 'row', alignItems: 'center', padding: 16 },
  circleIcon: { width: 50, height: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.lightPink },
  circleIconText: { color: Palette.strongPink, fontSize: 28 },
  circleCopy: { flex: 1, marginLeft: 14 },
  circleName: { color: Palette.text, fontSize: 18, lineHeight: 24, fontWeight: '800' },
  circleMeta: { color: Palette.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 4 },
  chevron: { color: Palette.strongPink, fontSize: 28, marginLeft: 8 },
  pendingList: { gap: 10 },
  pendingCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', padding: 15 },
  pendingIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4FBF6' },
  pendingIconText: { color: Palette.success, fontSize: 20, fontWeight: '800' },
  pendingCopy: { flex: 1, marginLeft: 12 },
  pendingTitle: { color: Palette.text, fontSize: 16, fontWeight: '800' },
  pendingText: { color: Palette.textSecondary, fontSize: 13, marginTop: 4 },
  pressed: { opacity: 0.7 },
});
