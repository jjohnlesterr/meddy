import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MeddyButton } from '@/components/meddy-button';
import { MeddyMascot } from '@/components/meddy-mascot';
import { MaxContentWidth, Palette } from '@/constants/theme';
import { FontFamily } from '@/constants/typography';

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.mascotStage}><View style={styles.pinkCircle} /><MeddyMascot state="default" style={styles.mascot} /></View>
          <Text style={styles.title}>Welcome to Meddy</Text>
          <Text style={styles.description}>Your simple medicine reminder companion.</Text>
          <MeddyButton label="Get Started" onPress={() => router.push('/login' as Href)} style={styles.button} />
        </View>
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.white }, scrollContent: { flexGrow: 1 }, safeArea: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20 },
  content: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  mascotStage: { width: '100%', height: Platform.OS === 'web' ? 310 : 280, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }, pinkCircle: { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: Palette.softPink }, mascot: { width: 235, height: 280 },
  // No explicit lineHeight: on Android a custom-font Text with a lineHeight tighter than
  // that font's real metrics can get its wrapped second line clipped entirely (the glyphs
  // are drawn outside the box RN computed from the declared lineHeight). Letting the
  // system measure it from the font itself is what keeps "Meddy" from disappearing when
  // this heading wraps to two lines on a narrow phone.
  title: { color: Palette.text, fontFamily: FontFamily.extraBold, fontSize: 26, textAlign: 'center', maxWidth: 440 }, description: { color: Palette.textSecondary, fontFamily: FontFamily.regular, fontSize: 17, lineHeight: 25, textAlign: 'center', maxWidth: 490, marginTop: 14 },
  button: { alignSelf: 'stretch', marginTop: 30 },
});
