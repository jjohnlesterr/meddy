import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/components/form-field';
import { MeddyButton } from '@/components/meddy-button';
import { MeddyMascot } from '@/components/meddy-mascot';
import { ScreenShell, sharedStyles } from '@/components/screen-shell';
import { Palette } from '@/constants/theme';
import { useAppState } from '@/context/app-state';
import { useCareCircles } from '@/context/care-circle-context';
import type { CareCircleSummary } from '@/types/care-circle';

function messageFromError(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return 'We could not create this Care Circle. Please try again.';
}

export default function CreateCareCircleScreen() {
  const router = useRouter();
  const { userName } = useAppState();
  const { createCircle } = useCareCircles();
  const [circleName, setCircleName] = useState('');
  const [createdCircle, setCreatedCircle] = useState<CareCircleSummary | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);

  async function create() {
    if (savingRef.current) return;
    if (!circleName.trim()) {
      setError('Please enter a name for your Care Circle.');
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setError('');
    try {
      setCreatedCircle(await createCircle(circleName));
    } catch (createError) {
      setError(messageFromError(createError));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  if (createdCircle) {
    return (
      <ScreenShell title="Circle created" subtitle="Your private Care Circle is ready." onBack={() => router.replace('/care-circle' as Href)}>
        <View style={styles.successCard}>
          <MeddyMascot state="success" style={styles.successMascot} />
          <Text style={styles.successTitle}>{createdCircle.name}</Text>
          <Text style={styles.successText}>Share this code with people you trust. You decide who is accepted.</Text>
        </View>
        <Text style={sharedStyles.sectionTitle}>Invite code</Text>
        <View style={styles.codeCard}>
          <Text selectable style={styles.code}>{createdCircle.inviteCode}</Text>
          <Text style={styles.codeHint}>Joining requires owner approval.</Text>
          <MeddyButton
            label="Share Code"
            onPress={() => void Share.share({ message: `Join ${createdCircle.name} on Meddy with code ${createdCircle.inviteCode}. Your request will need owner approval.` })}
            style={styles.shareButton}
          />
        </View>
        <Text style={sharedStyles.sectionTitle}>Your role</Text>
        <View style={[sharedStyles.card, styles.ownerCard]}>
          <View style={styles.ownerAvatar}><Text style={styles.ownerInitial}>{userName?.[0]?.toUpperCase() || 'Y'}</Text></View>
          <View><Text style={styles.ownerName}>{userName || 'You'}</Text><Text style={styles.ownerRole}>Owner</Text></View>
        </View>
        <MeddyButton label="Open Care Circle" onPress={() => router.replace(`/care/${createdCircle.id}` as Href)} style={styles.finishButton} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell keyboardSafe title="Create Care Circle" subtitle="Start a private group for family or caregivers." onBack={() => router.back()}>
      <View style={styles.intro}>
        <MeddyMascot state="careCircle" style={styles.introMascot} />
        <Text style={styles.introText}>You’ll be the Owner and approve each person who joins.</Text>
      </View>
      <View style={styles.form}>
        <FormField label="Circle Name" value={circleName} onChangeText={setCircleName} placeholder="Mom’s Care Circle" autoCapitalize="words" returnKeyType="done" onSubmitEditing={() => void create()} />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <MeddyButton label={isSaving ? 'Creating…' : 'Create Care Circle'} onPress={() => void create()} disabled={isSaving} />
      </View>
      <MeddyButton label="Cancel" onPress={() => router.back()} variant="secondary" style={styles.cancel} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  intro: { minHeight: 165, borderRadius: 26, backgroundColor: Palette.softPink, borderWidth: 1, borderColor: Palette.border, padding: 18, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  introMascot: { width: 125, height: 150, marginBottom: -15 },
  introText: { flex: 1, color: Palette.text, fontSize: 16, lineHeight: 24, fontWeight: '700', marginLeft: 10 },
  form: { gap: 16, marginTop: 26 },
  error: { color: Palette.danger, fontSize: 14, fontWeight: '700' },
  cancel: { marginTop: 12 },
  successCard: { alignItems: 'center', borderRadius: 28, backgroundColor: Palette.softPink, borderWidth: 1, borderColor: Palette.border, padding: 22 },
  successMascot: { width: 185, height: 210 },
  successTitle: { color: Palette.text, fontSize: 25, fontWeight: '800', textAlign: 'center' },
  successText: { color: Palette.textSecondary, fontSize: 15, lineHeight: 23, textAlign: 'center', maxWidth: 460, marginTop: 8 },
  codeCard: { borderRadius: 24, borderWidth: 1, borderColor: Palette.border, padding: 20, alignItems: 'center' },
  code: { color: Palette.strongPink, fontSize: 27, fontWeight: '800', letterSpacing: 1.5, textAlign: 'center' },
  codeHint: { color: Palette.textSecondary, fontSize: 13, marginTop: 7 },
  shareButton: { alignSelf: 'stretch', marginTop: 20 },
  ownerCard: { flexDirection: 'row', alignItems: 'center' },
  ownerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Palette.primaryPink, alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  ownerInitial: { color: Palette.white, fontSize: 18, fontWeight: '800' },
  ownerName: { color: Palette.text, fontSize: 17, fontWeight: '800' },
  ownerRole: { color: Palette.strongPink, fontSize: 13, fontWeight: '700', marginTop: 4 },
  finishButton: { marginTop: 24 },
});
