import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { MeddyButton } from '@/components/meddy-button';
import { MeddyMascot } from '@/components/meddy-mascot';
import { ScreenShell, sharedStyles } from '@/components/screen-shell';
import { Palette } from '@/constants/theme';
import { useAppState } from '@/context/app-state';

export default function HomeScreen() {
  const router = useRouter();
  const { careCircle, userName } = useAppState();
  const firstName = userName?.trim().split(/\s+/)[0];
  const greeting = firstName ? `Good morning, ${firstName}!` : 'Good morning!';

  return (
    <ScreenShell title={greeting}>
      <View style={styles.hero}>
        <View style={styles.heroCopy}><Text style={styles.eyebrow}>START WITH ONE SMALL STEP</Text><Text style={styles.heroTitle}>Let’s set up your first medicine.</Text><Text style={styles.heroText}>Add the medicine name, dose, and the time you usually take it.</Text></View>
        <MeddyMascot state="default" style={styles.mascot} />
      </View>
      <MeddyButton label="+  Add your first medicine" onPress={() => router.push('/medicines' as Href)} style={styles.primaryAction} />

      <Text style={sharedStyles.sectionTitle}>Care Circle</Text>
      {careCircle ? (
        <View style={[sharedStyles.card, styles.circleCard]}><View style={styles.circleIcon}><Text style={styles.circleIconText}>♡</Text></View><View style={styles.circleCopy}><Text style={styles.circleTitle}>{careCircle.name}</Text><Text style={styles.circleText}>Your private care group is ready.</Text></View><MeddyButton label="Open" onPress={() => router.push('/care-circle' as Href)} variant="secondary" style={styles.openButton} /></View>
      ) : (
        <View style={[sharedStyles.card, styles.careCard]}>
          <Text style={styles.careTitle}>Support feels better together.</Text>
          <Text style={styles.careText}>Stay connected with family or caregivers who can help you manage your medicines.</Text>
          <View style={styles.actions}><MeddyButton label="Create Care Circle" onPress={() => router.push('/care/create' as Href)} /><MeddyButton label="Join Care Circle" onPress={() => router.push('/care/join' as Href)} variant="secondary" /></View>
        </View>
      )}
      <View style={styles.note}><Text style={styles.noteIcon}>i</Text><Text style={styles.noteText}>Your day will stay simple and uncluttered until you add your first medicine.</Text></View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 230, borderRadius: 30, backgroundColor: Palette.softPink, padding: 22, overflow: 'hidden', flexDirection: 'row', borderWidth: 1, borderColor: Palette.border },
  heroCopy: { flex: 1, justifyContent: 'center', zIndex: 1 }, eyebrow: { color: Palette.strongPink, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, maxWidth: 190 }, heroTitle: { color: Palette.text, fontSize: 25, lineHeight: 32, fontWeight: '800', marginTop: 9, maxWidth: 220 }, heroText: { color: Palette.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 8, maxWidth: 215 }, mascot: { width: 145, height: 205, alignSelf: 'flex-end', marginRight: -14, marginBottom: -18 },
  primaryAction: { marginTop: 18 }, careCard: { backgroundColor: Palette.softPink }, careTitle: { color: Palette.text, fontSize: 20, fontWeight: '800' }, careText: { color: Palette.textSecondary, fontSize: 16, lineHeight: 24, marginTop: 8 }, actions: { gap: 11, marginTop: 20 },
  circleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.softPink }, circleIcon: { width: 48, height: 48, borderRadius: 18, backgroundColor: Palette.primaryPink, alignItems: 'center', justifyContent: 'center' }, circleIconText: { color: Palette.white, fontSize: 28 }, circleCopy: { flex: 1, marginLeft: 13 }, circleTitle: { color: Palette.text, fontSize: 17, fontWeight: '800' }, circleText: { color: Palette.textSecondary, fontSize: 13, marginTop: 4 }, openButton: { minHeight: 46, paddingHorizontal: 14 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 22, padding: 16 }, noteIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: Palette.lightPink, color: Palette.strongPink, textAlign: 'center', lineHeight: 24, fontWeight: '800' }, noteText: { flex: 1, color: Palette.textSecondary, fontSize: 13, lineHeight: 19 },
});
