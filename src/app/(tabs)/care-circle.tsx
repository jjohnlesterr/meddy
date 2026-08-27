import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { MeddyButton } from '@/components/meddy-button';
import { MeddyMascot } from '@/components/meddy-mascot';
import { ScreenShell, sharedStyles } from '@/components/screen-shell';
import { Palette } from '@/constants/theme';
import { useAppState } from '@/context/app-state';

export default function CareCircleScreen() {
  const router = useRouter();
  const { careCircle, joinPending, joinRequestStatus, reviewJoinRequest, showExampleJoinRequest, userName } = useAppState();

  if (!careCircle) {
    return (
      <ScreenShell title="Care Circle" subtitle="A private group for the people you trust.">
        <View style={styles.emptyCard}><MeddyMascot state="caring" style={styles.emptyMascot} /><Text style={styles.emptyTitle}>Create your circle or ask to join one.</Text><Text style={styles.emptyText}>Create a private Care Circle for family and caregivers, or join one using an invite code.</Text><View style={styles.emptyActions}><MeddyButton label="Create Care Circle" onPress={() => router.push('/care/create' as Href)} /><MeddyButton label="Join with Code" onPress={() => router.push('/care/join' as Href)} variant="secondary" /></View></View>
        {joinPending ? <View style={[sharedStyles.card, styles.pendingCard]}><Text style={styles.pendingIcon}>✓</Text><View style={styles.pendingCopy}><Text style={styles.pendingTitle}>Request pending</Text><Text style={styles.pendingText}>Your request has been sent to the Care Circle owner.</Text></View></View> : null}
        <Text style={sharedStyles.sectionTitle}>How joining works</Text>
        <View style={styles.flowCard}><FlowStep number="1" text="Enter the invite code" /><FlowStep number="2" text="The owner reviews your request" /><FlowStep number="3" text="Accepted members can enter the circle" last /></View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title={careCircle.name} subtitle="Your private Care Circle">
      <View style={styles.circleHero}><View><Text style={styles.codeLabel}>INVITE CODE</Text><Text style={styles.code}>{careCircle.code}</Text><Text style={styles.codeHint}>Share this only with people you trust.</Text></View><MeddyMascot state="caring" style={styles.heroMascot} /></View>
      <Text style={sharedStyles.sectionTitle}>Members</Text>
      <Member name={userName || 'You'} role="Owner" initials={userName ? initials(userName) : 'ME'} />
      {joinRequestStatus === 'accepted' ? <Member name="Maria Santos" role="Family Member" initials="MS" /> : null}

      <Text style={sharedStyles.sectionTitle}>Join Requests</Text>
      {joinRequestStatus === 'pending' ? (
        <View style={[sharedStyles.card, styles.requestCard]}><View style={styles.requestAvatar}><Text style={styles.requestInitials}>MS</Text></View><View style={styles.requestCopy}><Text style={styles.requestName}>Maria Santos</Text><Text style={styles.requestText}>wants to join your Care Circle</Text></View><View style={styles.requestActions}><MeddyButton label="Accept" onPress={() => reviewJoinRequest('accepted')} style={styles.smallButton} /><MeddyButton label="Reject" onPress={() => reviewJoinRequest('rejected')} variant="danger" style={styles.smallButton} /></View></View>
      ) : joinRequestStatus === 'none' ? (
        <View style={styles.noRequests}><Text style={styles.noRequestsTitle}>No pending requests</Text><Text style={styles.noRequestsText}>Requests will appear here when someone asks to join.</Text><MeddyButton label="Show example request" onPress={showExampleJoinRequest} variant="secondary" style={styles.exampleButton} /></View>
      ) : <View style={styles.reviewed}><Text style={styles.reviewedText}>{joinRequestStatus === 'accepted' ? '✓ Request accepted. Maria is now a member.' : 'Request rejected. No access was granted.'}</Text></View>}

      <Text style={sharedStyles.sectionTitle}>Roles</Text>
      <View style={styles.rolesCard}><Role title="Owner" detail="Manages the circle, members, and requests" /><Role title="Caregiver" detail="Can help manage medicine routines" /><Role title="Family Member" detail="Can offer support with limited access" last /></View>
    </ScreenShell>
  );
}

function initials(name: string) { return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }
function FlowStep({ number, text, last }: { number: string; text: string; last?: boolean }) { return <View style={[styles.flowRow, !last && styles.divider]}><Text style={styles.flowNumber}>{number}</Text><Text style={styles.flowText}>{text}</Text></View>; }
function Member({ name, role, initials: memberInitials }: { name: string; role: string; initials: string }) { return <View style={[sharedStyles.card, styles.member]}><View style={styles.memberAvatar}><Text style={styles.memberInitials}>{memberInitials}</Text></View><View><Text style={styles.memberName}>{name}</Text><Text style={styles.memberRole}>{role}</Text></View></View>; }
function Role({ title, detail, last }: { title: string; detail: string; last?: boolean }) { return <View style={[styles.roleRow, !last && styles.divider]}><View style={styles.roleDot} /><View><Text style={styles.roleTitle}>{title}</Text><Text style={styles.roleDetail}>{detail}</Text></View></View>; }

const styles = StyleSheet.create({
  emptyCard: { alignItems: 'center', backgroundColor: Palette.softPink, borderRadius: 30, borderWidth: 1, borderColor: Palette.border, padding: 24 }, emptyMascot: { width: 205, height: 225 }, emptyTitle: { color: Palette.text, fontSize: 23, lineHeight: 30, fontWeight: '800', textAlign: 'center', marginTop: 4 }, emptyText: { color: Palette.textSecondary, fontSize: 15, lineHeight: 23, textAlign: 'center', maxWidth: 480, marginTop: 10 }, emptyActions: { alignSelf: 'stretch', gap: 11, marginTop: 22 },
  pendingCard: { flexDirection: 'row', alignItems: 'center', marginTop: 18, backgroundColor: '#F4FBF6' }, pendingIcon: { width: 40, height: 40, borderRadius: 20, lineHeight: 40, textAlign: 'center', color: Palette.white, backgroundColor: Palette.success, fontSize: 20, fontWeight: '800' }, pendingCopy: { flex: 1, marginLeft: 13 }, pendingTitle: { color: Palette.text, fontSize: 16, fontWeight: '800' }, pendingText: { color: Palette.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 3 },
  flowCard: { borderRadius: 22, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 18 }, flowRow: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 13 }, divider: { borderBottomWidth: 1, borderBottomColor: Palette.border }, flowNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: Palette.lightPink, color: Palette.strongPink, textAlign: 'center', lineHeight: 32, fontWeight: '800' }, flowText: { color: Palette.text, fontSize: 15, fontWeight: '700' },
  circleHero: { minHeight: 185, borderRadius: 28, backgroundColor: Palette.softPink, borderWidth: 1, borderColor: Palette.border, padding: 22, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }, codeLabel: { color: Palette.strongPink, fontSize: 11, fontWeight: '800', letterSpacing: 1 }, code: { color: Palette.text, fontSize: 29, fontWeight: '800', letterSpacing: 1.5, marginTop: 7 }, codeHint: { color: Palette.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 7, maxWidth: 180 }, heroMascot: { width: 135, height: 165, marginLeft: 'auto', marginBottom: -18 },
  member: { flexDirection: 'row', alignItems: 'center', marginBottom: 11 }, memberAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Palette.primaryPink, alignItems: 'center', justifyContent: 'center', marginRight: 13 }, memberInitials: { color: Palette.white, fontWeight: '800' }, memberName: { color: Palette.text, fontSize: 17, fontWeight: '800' }, memberRole: { color: Palette.strongPink, fontSize: 13, fontWeight: '700', marginTop: 4 },
  requestCard: { gap: 12 }, requestAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: Palette.lightPink, alignItems: 'center', justifyContent: 'center' }, requestInitials: { color: Palette.strongPink, fontWeight: '800' }, requestCopy: { marginTop: 3 }, requestName: { color: Palette.text, fontSize: 17, fontWeight: '800' }, requestText: { color: Palette.textSecondary, fontSize: 14, marginTop: 3 }, requestActions: { flexDirection: 'row', gap: 10, marginTop: 4 }, smallButton: { flex: 1, minHeight: 48 }, reviewed: { borderRadius: 20, backgroundColor: Palette.softPink, padding: 18 }, reviewedText: { color: Palette.text, fontSize: 15, lineHeight: 22, fontWeight: '700' },
  noRequests: { borderRadius: 22, borderWidth: 1, borderColor: Palette.border, padding: 20 }, noRequestsTitle: { color: Palette.text, fontSize: 17, fontWeight: '800' }, noRequestsText: { color: Palette.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 5 }, exampleButton: { marginTop: 16, minHeight: 48 },
  rolesCard: { borderRadius: 22, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 18 }, roleRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 13 }, roleDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Palette.primaryPink }, roleTitle: { color: Palette.text, fontSize: 15, fontWeight: '800' }, roleDetail: { color: Palette.textSecondary, fontSize: 13, marginTop: 4 },
});
