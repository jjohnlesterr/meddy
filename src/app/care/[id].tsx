import type { Href } from 'expo-router';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { MeddyButton } from '@/components/meddy-button';
import { MedicineCard } from '@/components/medicine-card';
import { ScreenShell, sharedStyles } from '@/components/screen-shell';
import { Palette } from '@/constants/theme';
import { FontFamily } from '@/constants/typography';
import { useAppState } from '@/context/app-state';
import { useCareCircles } from '@/context/care-circle-context';
import { useMedicines } from '@/context/medicine-context';
import { fetchCareCircleDetails, reviewCareCircleRequest } from '@/lib/care-circles';
import type { CareCircleActivity, CareCircleDetails, CareCircleRole } from '@/types/care-circle';

type CircleTab = 'medicines' | 'members' | 'activity';
type Confirmation = 'delete' | 'leave' | null;

function roleLabel(role: CareCircleRole) {
  return role === 'family' ? 'Family Member' : `${role[0].toUpperCase()}${role.slice(1)}`;
}

function metadataText(activity: CareCircleActivity, key: string) {
  const value = activity.metadata[key];
  return typeof value === 'string' ? value : null;
}

function activityDescription(activity: CareCircleActivity) {
  const actor = activity.actorName ?? 'A member';
  const subject = activity.subjectName ?? 'A member';
  const medicineName = metadataText(activity, 'medicine_name') ?? 'a medicine';

  switch (activity.eventType) {
    case 'medicine_added': return `${actor} added ${medicineName}.`;
    case 'medicine_updated': return `${actor} updated ${medicineName}.`;
    case 'medicine_deleted': return `${actor} deleted ${medicineName}.`;
    case 'member_joined': return `${subject} joined the Care Circle.`;
    case 'member_left': return `${subject} left the Care Circle.`;
    case 'circle_updated': return `${actor} updated the Circle settings.`;
    case 'dose_taken': return `${actor} marked a dose as taken.`;
    case 'dose_snoozed': return `${actor} snoozed a dose.`;
    case 'dose_skipped': return `${actor} skipped a dose.`;
    case 'dose_missed': return `A scheduled dose was missed.`;
  }
}

function activityTime(value: string) {
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function messageFromError(error: unknown) {
  if (__DEV__ && error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return 'We could not load this Care Circle. Please try again.';
}

export default function CareCircleDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const circleId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { session } = useAppState();
  const userId = session?.user.id;
  const { deleteCircle, leaveCircle, refreshCircles } = useCareCircles();
  const { allMedicines, isLoading: medicinesLoading, error: medicinesError, refreshMedicines } = useMedicines();
  const [details, setDetails] = useState<CareCircleDetails | null>(null);
  const [selectedTab, setSelectedTab] = useState<CircleTab>('medicines');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const loadDetails = useCallback(async () => {
    if (!circleId || !userId) {
      setError('This Care Circle could not be found.');
      setIsLoading(false);
      return;
    }

    setError('');
    try {
      setDetails(await fetchCareCircleDetails(circleId, userId));
    } catch (loadError) {
      if (__DEV__) console.error('[Meddy Care Circle] Could not load details.', loadError);
      setError(messageFromError(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [circleId, userId]);

  useFocusEffect(useCallback(() => {
    const refreshTimer = setTimeout(() => {
      void Promise.all([loadDetails(), refreshMedicines()]);
    }, 0);
    return () => clearTimeout(refreshTimer);
  }, [loadDetails, refreshMedicines]));

  async function reviewRequest(requestId: string, decision: 'accepted' | 'rejected') {
    if (busyRequestId) return;
    setBusyRequestId(requestId);
    setError('');
    try {
      await reviewCareCircleRequest(requestId, decision);
      await Promise.all([loadDetails(), refreshCircles()]);
    } catch (reviewError) {
      if (__DEV__) console.error('[Meddy Care Circle] Could not review request.', reviewError);
      setError(messageFromError(reviewError));
    } finally {
      setBusyRequestId(null);
    }
  }

  async function confirmDestructiveAction() {
    if (!circleId || !confirmation || isConfirming) return;
    setIsConfirming(true);
    setError('');
    try {
      if (confirmation === 'delete') await deleteCircle(circleId);
      else await leaveCircle(circleId);
      setConfirmation(null);
      router.replace('/care-circle' as Href);
    } catch (actionError) {
      if (__DEV__) console.error('[Meddy Care Circle] Destructive action failed.', actionError);
      setError(messageFromError(actionError));
      setConfirmation(null);
    } finally {
      setIsConfirming(false);
    }
  }

  if (isLoading && !details) {
    return (
      <ScreenShell title="Care Circle" onBack={() => router.back()}>
        <View style={[sharedStyles.card, styles.stateCard]}><ActivityIndicator color={Palette.strongPink} size="large" /><Text style={styles.stateText}>Loading Care Circle…</Text></View>
      </ScreenShell>
    );
  }

  if (!details) {
    return (
      <ScreenShell title="Care Circle" onBack={() => router.back()}>
        <View style={[sharedStyles.card, styles.stateCard]}>
          <Text accessibilityRole="alert" style={styles.errorText}>{error || 'This Care Circle could not be found.'}</Text>
          <MeddyButton label="Try Again" onPress={() => void loadDetails()} variant="secondary" style={styles.retryButton} />
        </View>
      </ScreenShell>
    );
  }

  const canManageCircle = details.role === 'owner' || details.role === 'admin';
  const canEditMedicines = canManageCircle || details.role === 'caregiver';
  const canDeleteMedicines = canManageCircle;
  const circleMedicines = allMedicines.filter((medicine) => medicine.care_circle_id === details.id);

  const moreAction = (
    <Pressable accessibilityLabel="More Care Circle options" accessibilityRole="button" onPress={() => setMoreOpen(true)} style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}>
      <Text style={styles.moreText}>⋯</Text>
    </Pressable>
  );

  return (
    <>
      <ScreenShell title={details.name} subtitle={roleLabel(details.role)} onBack={() => router.back()} rightAction={moreAction}>
        {error ? <Text accessibilityRole="alert" style={styles.inlineError}>{error}</Text> : null}

        <View accessibilityRole="tablist" style={styles.tabs}>
          {(['medicines', 'members', 'activity'] as CircleTab[]).map((tab) => (
            <Pressable
              key={tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: selectedTab === tab }}
              onPress={() => setSelectedTab(tab)}
              style={[styles.tab, selectedTab === tab && styles.selectedTab]}>
              <Text style={[styles.tabText, selectedTab === tab && styles.selectedTabText]}>{tab[0].toUpperCase() + tab.slice(1)}</Text>
            </Pressable>
          ))}
        </View>

        {selectedTab === 'medicines' ? (
          <View style={styles.tabContent}>
            <View style={styles.sectionRow}>
              <View><Text style={styles.sectionTitle}>Medicines</Text><Text style={styles.sectionMeta}>{circleMedicines.length} {circleMedicines.length === 1 ? 'medicine' : 'medicines'}</Text></View>
              {canEditMedicines ? (
                <MeddyButton label="+ Add Medicine" onPress={() => router.push(`/medicine/add?careCircleId=${details.id}` as Href)} variant="secondary" style={styles.addButton} />
              ) : null}
            </View>
            {medicinesLoading ? (
              <View style={[sharedStyles.card, styles.compactState]}><ActivityIndicator color={Palette.strongPink} /><Text style={styles.stateText}>Loading medicines…</Text></View>
            ) : medicinesError ? (
              <View style={[sharedStyles.card, styles.compactState]}><Text accessibilityRole="alert" style={styles.errorText}>Medicines could not be loaded.</Text><MeddyButton label="Try Again" onPress={() => void refreshMedicines()} variant="secondary" style={styles.retryButton} /></View>
            ) : circleMedicines.length === 0 ? (
              <View style={[sharedStyles.card, styles.emptyState]}><Text style={styles.emptyTitle}>No medicines yet</Text><Text style={styles.emptyText}>Add a medicine to get started.</Text></View>
            ) : (
              <View style={styles.list}>{circleMedicines.map((medicine) => <MedicineCard key={medicine.id} medicine={medicine} onPress={() => router.push(`/medicine/${medicine.id}` as Href)} />)}</View>
            )}
            {!canDeleteMedicines && circleMedicines.length > 0 ? <Text style={styles.permissionNote}>{canEditMedicines ? 'Owner or Admin approval is required to delete shared medicines.' : 'Your role has view-only medicine access.'}</Text> : null}
          </View>
        ) : null}

        {selectedTab === 'members' ? (
          <View style={styles.tabContent}>
            {canManageCircle && details.pendingRequests.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Join requests</Text>
                <View style={styles.list}>
                  {details.pendingRequests.map((request) => (
                    <View key={request.id} style={[sharedStyles.card, styles.requestCard]}>
                      <View style={styles.memberRow}><Avatar name={request.fullName} /><View style={styles.memberCopy}><Text style={styles.memberName}>{request.fullName}</Text><Text style={styles.memberRole}>Waiting for approval</Text></View></View>
                      <View style={styles.requestActions}>
                        <Pressable accessibilityRole="button" disabled={Boolean(busyRequestId)} onPress={() => void reviewRequest(request.id, 'rejected')} style={styles.rejectAction}><Text style={styles.rejectText}>Reject</Text></Pressable>
                        <Pressable accessibilityRole="button" disabled={Boolean(busyRequestId)} onPress={() => void reviewRequest(request.id, 'accepted')} style={styles.acceptAction}><Text style={styles.acceptText}>{busyRequestId === request.id ? 'Saving…' : 'Accept'}</Text></Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
            <Text style={[styles.sectionTitle, canManageCircle && details.pendingRequests.length > 0 && styles.memberSectionTitle]}>Members</Text>
            <View style={styles.list}>
              {details.members.map((member) => (
                <View key={member.userId} style={[sharedStyles.card, styles.memberCard]}><Avatar name={member.fullName} /><View style={styles.memberCopy}><Text style={styles.memberName}>{member.fullName}</Text><Text style={styles.memberRole}>{roleLabel(member.role)}</Text></View></View>
              ))}
            </View>
          </View>
        ) : null}

        {selectedTab === 'activity' ? (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Activity</Text>
            {details.activity.length === 0 ? (
              <View style={[sharedStyles.card, styles.emptyState]}><Text style={styles.emptyTitle}>No activity yet</Text><Text style={styles.emptyText}>Activity from this Care Circle will appear here.</Text></View>
            ) : (
              <View style={styles.list}>{details.activity.map((activity) => <ActivityRow key={activity.id} activity={activity} />)}</View>
            )}
          </View>
        ) : null}
      </ScreenShell>

      <Modal transparent animationType="fade" visible={moreOpen} onRequestClose={() => setMoreOpen(false)}>
        <View style={styles.menuOverlay}>
          <Pressable accessibilityLabel="Close menu" accessibilityRole="button" onPress={() => setMoreOpen(false)} style={StyleSheet.absoluteFill} />
          <View accessibilityViewIsModal style={styles.menuCard}>
            <Text style={styles.menuTitle}>Care Circle</Text>
            <MenuOption label="Share / Invite" onPress={() => { setMoreOpen(false); setInviteOpen(true); }} />
            {canManageCircle ? <MenuOption label="Circle Settings" onPress={() => { setMoreOpen(false); router.push(`/care/settings/${details.id}` as Href); }} /> : null}
            {canManageCircle ? <MenuOption label="Delete Care Circle" onPress={() => { setMoreOpen(false); setConfirmation('delete'); }} /> : <MenuOption label="Leave Care Circle" onPress={() => { setMoreOpen(false); setConfirmation('leave'); }} />}
            <MenuOption label="Cancel" onPress={() => setMoreOpen(false)} />
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="fade" visible={inviteOpen} onRequestClose={() => setInviteOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.modalCard}>
            <Text style={styles.modalTitle}>Invite to Care Circle</Text>
            <Text selectable style={styles.inviteCode}>{details.inviteCode}</Text>
            <Text style={styles.modalText}>Share this code with someone you trust.</Text>
            <MeddyButton label="Share Code" onPress={() => void Share.share({ message: `Join ${details.name} on Meddy with code ${details.inviteCode}. Your request will need approval.` })} style={styles.modalPrimary} />
            <MeddyButton label="Close" onPress={() => setInviteOpen(false)} variant="secondary" style={styles.modalSecondary} />
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="fade" visible={confirmation !== null} onRequestClose={() => !isConfirming && setConfirmation(null)}>
        <View style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.modalCard}>
            <Text style={styles.modalTitle}>{confirmation === 'delete' ? 'Delete Care Circle?' : 'Leave Care Circle?'}</Text>
            <Text style={styles.modalText}>{confirmation === 'delete' ? 'This will remove the Circle and its shared data. This action cannot be undone.' : `You’ll no longer have access to ${details.name}.`}</Text>
            <View style={styles.modalActions}>
              <MeddyButton label="Cancel" onPress={() => setConfirmation(null)} disabled={isConfirming} variant="secondary" style={styles.modalButton} />
              <MeddyButton label={isConfirming ? 'Please wait…' : confirmation === 'delete' ? 'Delete' : 'Leave'} onPress={() => void confirmDestructiveAction()} disabled={isConfirming} variant="danger" style={styles.modalButton} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Avatar({ name }: { name: string }) {
  return <View style={styles.avatar}><Text style={styles.avatarText}>{name[0]?.toUpperCase() || '?'}</Text></View>;
}

function MenuOption({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.menuOption, pressed && styles.pressed]}><Text style={styles.menuOptionText}>{label}</Text></Pressable>;
}

function ActivityRow({ activity }: { activity: CareCircleActivity }) {
  return (
    <View style={[sharedStyles.card, styles.activityCard]}>
      <View style={styles.activityDot} />
      <View style={styles.activityCopy}><Text style={styles.activityText}>{activityDescription(activity)}</Text><Text style={styles.activityTime}>{activityTime(activity.actionAt)}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  stateCard: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 12 },
  compactState: { minHeight: 110, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
  stateText: { color: Palette.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', fontFamily: FontFamily.regular },
  errorText: { color: Palette.danger, fontSize: 15, lineHeight: 22, textAlign: 'center', fontFamily: FontFamily.regular },
  retryButton: { minHeight: 46, marginTop: 4 },
  inlineError: { color: Palette.danger, backgroundColor: '#FFF4F4', borderRadius: 14, padding: 13, fontSize: 14, lineHeight: 20, marginBottom: 14, fontFamily: FontFamily.regular },
  moreButton: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.white },
  moreText: { color: Palette.text, fontSize: 28, lineHeight: 28, fontFamily: FontFamily.extraBold, marginTop: -8 },
  tabs: { flexDirection: 'row', borderRadius: 18, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.softPink, padding: 4 },
  tab: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingHorizontal: 6 },
  selectedTab: { backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.border },
  tabText: { color: Palette.textSecondary, fontSize: 14, lineHeight: 19, fontFamily: FontFamily.bold },
  selectedTabText: { color: Palette.strongPink, fontFamily: FontFamily.extraBold },
  tabContent: { marginTop: 22 },
  sectionRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  sectionTitle: { color: Palette.text, fontSize: 21, lineHeight: 27, fontFamily: FontFamily.extraBold, marginBottom: 14 },
  sectionMeta: { color: Palette.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 2, fontFamily: FontFamily.regular },
  addButton: { minHeight: 46, borderRadius: 15, paddingHorizontal: 13 },
  emptyState: { padding: 18 },
  emptyTitle: { color: Palette.text, fontSize: 18, lineHeight: 24, fontFamily: FontFamily.extraBold },
  emptyText: { color: Palette.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 5, fontFamily: FontFamily.regular },
  list: { gap: 10 },
  permissionNote: { color: Palette.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 14, fontFamily: FontFamily.regular },
  memberSectionTitle: { marginTop: 26 },
  memberCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', padding: 14 },
  memberRow: { flexDirection: 'row', alignItems: 'center' },
  requestCard: { padding: 14 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: Palette.lightPink, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Palette.strongPink, fontSize: 17, fontFamily: FontFamily.extraBold },
  memberCopy: { flex: 1, marginLeft: 12 },
  memberName: { color: Palette.text, fontSize: 16, lineHeight: 22, fontFamily: FontFamily.extraBold },
  memberRole: { color: Palette.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 3, fontFamily: FontFamily.regular },
  requestActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 13 },
  rejectAction: { minHeight: 44, minWidth: 76, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 13 },
  rejectText: { color: Palette.textSecondary, fontSize: 14, fontFamily: FontFamily.extraBold },
  acceptAction: { minHeight: 44, minWidth: 82, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: Palette.strongPink, paddingHorizontal: 13 },
  acceptText: { color: Palette.white, fontSize: 14, fontFamily: FontFamily.extraBold },
  activityCard: { minHeight: 76, flexDirection: 'row', alignItems: 'flex-start', padding: 15 },
  activityDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Palette.primaryPink, marginTop: 5 },
  activityCopy: { flex: 1, marginLeft: 12 },
  activityText: { color: Palette.text, fontSize: 15, lineHeight: 22, fontFamily: FontFamily.bold },
  activityTime: { color: Palette.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 4, fontFamily: FontFamily.regular },
  menuOverlay: { flex: 1, alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 96, backgroundColor: 'rgba(43, 43, 43, 0.28)' },
  menuCard: { width: 260, borderRadius: 22, backgroundColor: Palette.white, padding: 10 },
  menuTitle: { color: Palette.textSecondary, fontSize: 12, lineHeight: 17, fontFamily: FontFamily.extraBold, letterSpacing: 0.8, paddingHorizontal: 12, paddingVertical: 8 },
  menuOption: { minHeight: 50, justifyContent: 'center', borderRadius: 14, paddingHorizontal: 13 },
  menuOptionText: { color: Palette.text, fontSize: 16, lineHeight: 22, fontFamily: FontFamily.bold },
  pressed: { opacity: 0.62, backgroundColor: Palette.softPink },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(43, 43, 43, 0.42)' },
  modalCard: { width: '100%', maxWidth: 440, alignSelf: 'center', borderRadius: 26, backgroundColor: Palette.white, padding: 22 },
  modalTitle: { color: Palette.text, fontSize: 23, lineHeight: 30, fontFamily: FontFamily.extraBold, textAlign: 'center' },
  inviteCode: { color: Palette.strongPink, fontSize: 28, lineHeight: 36, fontFamily: FontFamily.extraBold, letterSpacing: 1.5, textAlign: 'center', marginTop: 18 },
  modalText: { color: Palette.textSecondary, fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 9, fontFamily: FontFamily.regular },
  modalPrimary: { marginTop: 22 },
  modalSecondary: { minHeight: 52, marginTop: 11 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 22 },
  modalButton: { flex: 1, minHeight: 52, paddingHorizontal: 12 },
});
