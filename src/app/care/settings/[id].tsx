import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/components/form-field';
import { MeddyButton } from '@/components/meddy-button';
import { ScreenShell } from '@/components/screen-shell';
import { Palette } from '@/constants/theme';
import { FontFamily } from '@/constants/typography';
import { useCareCircles } from '@/context/care-circle-context';
import { friendlySupabaseErrorMessage } from '@/lib/supabase';

const CIRCLE_NAME_MAX_LENGTH = 60;

function messageFromError(error: unknown) {
  return friendlySupabaseErrorMessage(error, 'We could not save these settings. Please try again.');
}

export default function CareCircleSettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const circleId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { circles, updateCircle } = useCareCircles();
  const circle = circles.find((item) => item.id === circleId);
  const [name, setName] = useState(circle?.name ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const canManage = circle?.role === 'owner' || circle?.role === 'admin';

  async function save() {
    if (!circleId || !canManage || isSaving) return;
    if (!name.trim()) {
      setError('Enter a Care Circle name.');
      return;
    }
    if (name.trim().length > CIRCLE_NAME_MAX_LENGTH) {
      setError(`Circle name must be ${CIRCLE_NAME_MAX_LENGTH} characters or fewer.`);
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      await updateCircle(circleId, name);
      router.back();
    } catch (saveError) {
      if (__DEV__) console.error('[Meddy Care Circle] Could not update settings.', saveError);
      setError(messageFromError(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  if (!circle || !canManage) {
    return (
      <ScreenShell title="Circle Settings" onBack={() => router.back()}>
        <View style={styles.unavailableCard}>
          <Text accessibilityRole="alert" style={styles.unavailableTitle}>Settings unavailable</Text>
          <Text style={styles.unavailableText}>Only an Owner or Admin can change Circle settings.</Text>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell keyboardSafe title="Circle Settings" subtitle={circle.name} onBack={() => router.back()}>
      <View style={styles.form}>
        <FormField label="Circle Name" value={name} onChangeText={setName} autoCapitalize="words" maxLength={CIRCLE_NAME_MAX_LENGTH} returnKeyType="done" onSubmitEditing={() => void save()} />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <MeddyButton label={isSaving ? 'Saving…' : 'Save Changes'} onPress={() => void save()} disabled={isSaving} />
        <MeddyButton label="Cancel" onPress={() => router.back()} disabled={isSaving} variant="secondary" />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  error: { color: Palette.danger, fontSize: 14, lineHeight: 20, fontFamily: FontFamily.bold },
  unavailableCard: { borderRadius: 24, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.softPink, padding: 20 },
  unavailableTitle: { color: Palette.text, fontSize: 19, lineHeight: 25, fontFamily: FontFamily.extraBold },
  unavailableText: { color: Palette.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 6, fontFamily: FontFamily.regular },
});
