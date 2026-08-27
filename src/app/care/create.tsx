import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/components/form-field';
import { MeddyButton } from '@/components/meddy-button';
import { MeddyMascot } from '@/components/meddy-mascot';
import { ScreenShell, sharedStyles } from '@/components/screen-shell';
import { Palette } from '@/constants/theme';
import { useAppState } from '@/context/app-state';

export default function CreateCareCircleScreen() {
  const router = useRouter();
  const { careCircle, createCircle, userName } = useAppState();
  const [circleName, setCircleName] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  function create() {
    if (!circleName.trim()) return setError('Please enter a name for your Care Circle.');
    createCircle(circleName);
    setError('');
  }

  if (careCircle) {
    return (
      <ScreenShell title="Circle created" subtitle="Your private Care Circle is ready.">
        <View style={styles.successCard}><MeddyMascot state="success" style={styles.successMascot} /><Text style={styles.successTitle}>{careCircle.name}</Text><Text style={styles.successText}>Share this invite code with people you trust. They must request to join, and you decide who is accepted.</Text></View>
        <Text style={sharedStyles.sectionTitle}>Invite code</Text>
        <View style={styles.codeCard}><Text style={styles.code}>{careCircle.code}</Text><Text style={styles.codeHint}>Codes do not grant automatic access.</Text><View style={styles.codeActions}><MeddyButton label={copied ? '✓ Code Copied' : 'Copy Code'} onPress={() => setCopied(true)} variant="secondary" style={styles.flexButton} /><MeddyButton label="Share Code" onPress={() => Share.share({ message: `Join ${careCircle.name} on Meddy with code ${careCircle.code}. Your request will need owner approval.` })} style={styles.flexButton} /></View></View>
        <Text style={sharedStyles.sectionTitle}>Your role</Text>
        <View style={[sharedStyles.card, styles.ownerCard]}><View style={styles.ownerAvatar}><Text style={styles.ownerInitial}>{userName?.[0]?.toUpperCase() || 'Y'}</Text></View><View><Text style={styles.ownerName}>{userName || 'You'}</Text><Text style={styles.ownerRole}>Owner</Text></View></View>
        <MeddyButton label="Open Care Circle" onPress={() => router.replace('/care-circle' as Href)} style={styles.finishButton} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Create Care Circle" subtitle="Start a private group for your family or caregivers.">
      <View style={styles.intro}><MeddyMascot state="caring" style={styles.introMascot} /><Text style={styles.introText}>You’ll be the Owner. You can review requests before anyone joins.</Text></View>
      <View style={styles.form}><FormField label="Circle Name" value={circleName} onChangeText={setCircleName} placeholder="Mom’s Care Circle" autoCapitalize="words" returnKeyType="done" onSubmitEditing={create} />{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<MeddyButton label="Create Care Circle" onPress={create} /></View>
      <MeddyButton label="Cancel" onPress={() => router.back()} variant="secondary" style={styles.cancel} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  intro: { minHeight: 165, borderRadius: 26, backgroundColor: Palette.softPink, borderWidth: 1, borderColor: Palette.border, padding: 18, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }, introMascot: { width: 125, height: 150, marginBottom: -15 }, introText: { flex: 1, color: Palette.text, fontSize: 16, lineHeight: 24, fontWeight: '700', marginLeft: 10 }, form: { gap: 16, marginTop: 26 }, error: { color: Palette.danger, fontSize: 14, fontWeight: '700' }, cancel: { marginTop: 12 },
  successCard: { alignItems: 'center', borderRadius: 28, backgroundColor: Palette.softPink, borderWidth: 1, borderColor: Palette.border, padding: 22 }, successMascot: { width: 185, height: 210 }, successTitle: { color: Palette.text, fontSize: 25, fontWeight: '800', textAlign: 'center' }, successText: { color: Palette.textSecondary, fontSize: 15, lineHeight: 23, textAlign: 'center', maxWidth: 460, marginTop: 8 },
  codeCard: { borderRadius: 24, borderWidth: 1, borderColor: Palette.border, padding: 20, alignItems: 'center' }, code: { color: Palette.strongPink, fontSize: 32, fontWeight: '800', letterSpacing: 2 }, codeHint: { color: Palette.textSecondary, fontSize: 13, marginTop: 7 }, codeActions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 20 }, flexButton: { flex: 1, minHeight: 52 },
  ownerCard: { flexDirection: 'row', alignItems: 'center' }, ownerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Palette.primaryPink, alignItems: 'center', justifyContent: 'center', marginRight: 13 }, ownerInitial: { color: Palette.white, fontSize: 18, fontWeight: '800' }, ownerName: { color: Palette.text, fontSize: 17, fontWeight: '800' }, ownerRole: { color: Palette.strongPink, fontSize: 13, fontWeight: '700', marginTop: 4 }, finishButton: { marginTop: 24 },
});
