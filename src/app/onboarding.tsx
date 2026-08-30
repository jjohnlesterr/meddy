import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MeddyButton } from '@/components/meddy-button';
import { MeddyLogo } from '@/components/meddy-logo';
import { Palette } from '@/constants/theme';
import { FontFamily } from '@/constants/typography';
import { OnboardingPreference, useAppState } from '@/context/app-state';

const options: { value: OnboardingPreference; icon: string; title: string; description: string }[] = [
  { value: 'self', icon: '♡', title: 'I manage my own medicines', description: 'Get reminders and keep track of your medication schedule.' },
  { value: 'caregiver', icon: '○', title: 'I help care for someone else', description: 'Stay connected and help manage medications through Care Circle.' },
];

export default function OnboardingScreen() {
  const { completeOnboarding, onboardingPreference } = useAppState();
  const [selection, setSelection] = useState<OnboardingPreference | null>(onboardingPreference);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function continueToApp() {
    if (!selection) return;
    setError('');
    setIsSubmitting(true);
    const result = await completeOnboarding(selection);
    setIsSubmitting(false);
    if (result.error) setError(result.error);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scroll}>
      <SafeAreaView style={styles.safeArea}><View style={styles.content}>
        <MeddyLogo style={styles.logo} />
        <Text style={styles.title}>How will you use Meddy?</Text>
        <Text style={styles.subtitle}>This helps Meddy personalize your experience. You can still use both features later.</Text>
        <View style={styles.options}>{options.map((option) => {
          const selected = selection === option.value;
          return (
            <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => setSelection(option.value)} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}>
              <View style={[styles.optionIcon, selected && styles.optionIconSelected]}><Text style={[styles.optionIconText, selected && styles.optionIconTextSelected]}>{selected ? '✓' : option.icon}</Text></View>
              <View style={styles.optionCopy}><Text style={styles.optionTitle}>{option.title}</Text><Text style={styles.optionDescription}>{option.description}</Text></View>
            </Pressable>
          );
        })}</View>
        <View style={styles.note}><Text style={styles.noteText}>This is only a starting preference. Care Circle roles are assigned separately for each circle.</Text></View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <MeddyButton label={isSubmitting ? 'Saving…' : 'Continue'} onPress={continueToApp} disabled={!selection || isSubmitting} style={styles.button} />
      </View></SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.white }, scroll: { flexGrow: 1 }, safeArea: { flex: 1, alignItems: 'center', paddingHorizontal: 22, paddingVertical: 26 }, content: { width: '100%', maxWidth: 580 },
  logo: { width: 70, height: 70, alignSelf: 'center' }, title: { color: Palette.text, fontSize: 30, lineHeight: 37, fontFamily: FontFamily.extraBold, textAlign: 'center', marginTop: 18 }, subtitle: { color: Palette.textSecondary, fontSize: 16, lineHeight: 24, textAlign: 'center', marginTop: 10, fontFamily: FontFamily.regular },
  options: { gap: 14, marginTop: 28 }, option: { minHeight: 138, flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: Palette.border, backgroundColor: Palette.white, borderRadius: 24, padding: 20 }, optionSelected: { borderColor: Palette.strongPink, backgroundColor: Palette.softPink }, pressed: { opacity: 0.72 },
  optionIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.softPink }, optionIconSelected: { backgroundColor: Palette.strongPink }, optionIconText: { color: Palette.strongPink, fontSize: 25, fontFamily: FontFamily.extraBold }, optionIconTextSelected: { color: Palette.white },
  optionCopy: { flex: 1, marginLeft: 16 }, optionTitle: { color: Palette.text, fontSize: 19, lineHeight: 25, fontFamily: FontFamily.extraBold }, optionDescription: { color: Palette.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 6, fontFamily: FontFamily.regular },
  note: { backgroundColor: Palette.softPink, borderRadius: 18, padding: 15, marginTop: 20 }, noteText: { color: Palette.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center', fontFamily: FontFamily.regular }, error: { color: Palette.danger, fontSize: 14, lineHeight: 20, fontFamily: FontFamily.bold, marginTop: 16, textAlign: 'center' }, button: { marginTop: 22 },
});
