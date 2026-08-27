import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/components/form-field';
import { MeddyButton } from '@/components/meddy-button';
import { MeddyMascot } from '@/components/meddy-mascot';
import { ScreenShell } from '@/components/screen-shell';
import { Palette } from '@/constants/theme';
import { useCareCircles } from '@/context/care-circle-context';
import type { JoinCareCircleResult } from '@/types/care-circle';

function messageFromError(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return 'We could not use this invite code. Please check it and try again.';
}

export default function JoinCareCircleScreen() {
  const router = useRouter();
  const { joinCircle } = useCareCircles();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<JoinCareCircleResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);

  async function submit() {
    if (submittingRef.current) return;
    if (!code.trim()) {
      setError('Please enter an invite code.');
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setError('');
    try {
      const nextResult = await joinCircle(code);
      if (nextResult.status === 'member' || nextResult.status === 'accepted') {
        router.replace(`/care/${nextResult.circleId}` as Href);
        return;
      }
      setResult(nextResult);
    } catch (joinError) {
      setError(messageFromError(joinError));
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  if (result?.status === 'pending') {
    return (
      <ScreenShell title="Request sent" subtitle={result.circleName} onBack={() => router.replace('/care-circle' as Href)}>
        <View style={styles.pendingCard}>
          <MeddyMascot state="careCircle" style={styles.pendingMascot} />
          <View style={styles.check}><Text style={styles.checkText}>✓</Text></View>
          <Text style={styles.pendingTitle}>Your request is waiting for approval.</Text>
          <Text style={styles.pendingText}>You’ll become a member after an Owner or Admin accepts it.</Text>
          <MeddyButton label="Back to Care Circle" onPress={() => router.replace('/care-circle' as Href)} style={styles.button} />
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell keyboardSafe title="Join a Care Circle" subtitle="Use a private invite code." onBack={() => router.back()}>
      <View style={styles.hero}>
        <MeddyMascot state="careCircle" style={styles.mascot} />
        <Text style={styles.heroText}>The circle owner will review your request before you join.</Text>
      </View>
      <View style={styles.form}>
        <FormField label="Enter invite code" value={code} onChangeText={(value) => setCode(value.toUpperCase())} placeholder="MEDDY-AB12CD34" autoCapitalize="characters" autoCorrect={false} returnKeyType="send" onSubmitEditing={() => void submit()} />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <MeddyButton label={isSubmitting ? 'Sending…' : 'Request to Join'} onPress={() => void submit()} disabled={isSubmitting} />
      </View>
      <MeddyButton label="Cancel" onPress={() => router.back()} variant="secondary" style={styles.cancel} />
      <View style={styles.privacyNote}>
        <Text style={styles.privacyTitle}>Your privacy matters</Text>
        <Text style={styles.privacyText}>Only accepted members receive access.</Text>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 175, borderRadius: 27, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.softPink, padding: 18, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  mascot: { width: 130, height: 160, marginBottom: -15 },
  heroText: { flex: 1, color: Palette.text, fontSize: 16, lineHeight: 24, fontWeight: '700', marginLeft: 8 },
  form: { gap: 16, marginTop: 26 },
  error: { color: Palette.danger, fontSize: 14, fontWeight: '700' },
  cancel: { marginTop: 12 },
  privacyNote: { marginTop: 22, padding: 18 },
  privacyTitle: { color: Palette.text, fontSize: 15, fontWeight: '800' },
  privacyText: { color: Palette.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 5 },
  pendingCard: { alignItems: 'center', borderRadius: 30, backgroundColor: Palette.softPink, borderWidth: 1, borderColor: Palette.border, padding: 24 },
  pendingMascot: { width: 190, height: 215 },
  check: { width: 46, height: 46, borderRadius: 23, backgroundColor: Palette.success, alignItems: 'center', justifyContent: 'center', marginTop: -4 },
  checkText: { color: Palette.white, fontSize: 23, fontWeight: '800' },
  pendingTitle: { color: Palette.text, fontSize: 22, lineHeight: 29, fontWeight: '800', textAlign: 'center', maxWidth: 440, marginTop: 17 },
  pendingText: { color: Palette.textSecondary, fontSize: 15, lineHeight: 23, textAlign: 'center', maxWidth: 470, marginTop: 9 },
  button: { alignSelf: 'stretch', marginTop: 24 },
});
