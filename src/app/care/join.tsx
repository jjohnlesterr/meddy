import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/components/form-field';
import { MeddyButton } from '@/components/meddy-button';
import { MeddyMascot } from '@/components/meddy-mascot';
import { ScreenShell } from '@/components/screen-shell';
import { Palette } from '@/constants/theme';
import { useAppState } from '@/context/app-state';

export default function JoinCareCircleScreen() {
  const router = useRouter();
  const { joinPending, submitJoinRequest } = useAppState();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  function submit() {
    if (!code.trim()) return setError('Please enter an invite code.');
    submitJoinRequest();
    setError('');
  }

  if (joinPending) {
    return (
      <ScreenShell title="Request sent" subtitle="The owner will review your request.">
        <View style={styles.pendingCard}><MeddyMascot state="caring" style={styles.pendingMascot} /><View style={styles.check}><Text style={styles.checkText}>✓</Text></View><Text style={styles.pendingTitle}>Your request has been sent to the Care Circle owner for approval.</Text><Text style={styles.pendingText}>Entering a code does not grant access automatically. You’ll become a member only after the Owner accepts you.</Text><MeddyButton label="Back to Care Circle" onPress={() => router.replace('/care-circle' as Href)} style={styles.button} /></View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Join a Care Circle" subtitle="Ask to join a private group using its invite code.">
      <View style={styles.hero}><MeddyMascot state="caring" style={styles.mascot} /><Text style={styles.heroText}>The circle owner will receive your request and choose whether to accept or reject it.</Text></View>
      <View style={styles.form}><FormField label="Enter invite code" value={code} onChangeText={(value) => setCode(value.toUpperCase())} placeholder="MEDDY-4821" autoCapitalize="characters" autoCorrect={false} returnKeyType="send" onSubmitEditing={submit} />{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<MeddyButton label="Request to Join" onPress={submit} /></View>
      <MeddyButton label="Cancel" onPress={() => router.back()} variant="secondary" style={styles.cancel} />
      <View style={styles.privacyNote}><Text style={styles.privacyTitle}>Your privacy matters</Text><Text style={styles.privacyText}>Only accepted members receive access. Each person’s role will be shown clearly before access is granted.</Text></View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 175, borderRadius: 27, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.softPink, padding: 18, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }, mascot: { width: 130, height: 160, marginBottom: -15 }, heroText: { flex: 1, color: Palette.text, fontSize: 16, lineHeight: 24, fontWeight: '700', marginLeft: 8 }, form: { gap: 16, marginTop: 26 }, error: { color: Palette.danger, fontSize: 14, fontWeight: '700' }, cancel: { marginTop: 12 }, privacyNote: { marginTop: 22, padding: 18 }, privacyTitle: { color: Palette.text, fontSize: 15, fontWeight: '800' }, privacyText: { color: Palette.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 5 },
  pendingCard: { alignItems: 'center', borderRadius: 30, backgroundColor: Palette.softPink, borderWidth: 1, borderColor: Palette.border, padding: 24 }, pendingMascot: { width: 190, height: 215 }, check: { width: 46, height: 46, borderRadius: 23, backgroundColor: Palette.success, alignItems: 'center', justifyContent: 'center', marginTop: -4 }, checkText: { color: Palette.white, fontSize: 23, fontWeight: '800' }, pendingTitle: { color: Palette.text, fontSize: 22, lineHeight: 29, fontWeight: '800', textAlign: 'center', maxWidth: 440, marginTop: 17 }, pendingText: { color: Palette.textSecondary, fontSize: 15, lineHeight: 23, textAlign: 'center', maxWidth: 470, marginTop: 9 }, button: { alignSelf: 'stretch', marginTop: 24 },
});
