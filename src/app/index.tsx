import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MeddyButton } from '@/components/meddy-button';
import { MeddyLogo } from '@/components/meddy-logo';
import { MeddyMascot } from '@/components/meddy-mascot';
import { MaxContentWidth, Palette } from '@/constants/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <MeddyLogo style={styles.logo} />
          <Text style={styles.brand}>Meddy</Text>
          <View style={styles.mascotStage}><View style={styles.pinkCircle} /><MeddyMascot state="default" style={styles.mascot} /></View>
          <Text style={styles.title}>Your gentle medication companion.</Text>
          <Text style={styles.description}>Stay on track with your medicines and stay connected with the people who care for you.</Text>
          <MeddyButton label="Get Started" onPress={() => router.push('/auth' as Href)} style={styles.button} />
          <Text style={styles.reassurance}>Simple reminders. Caring support. Peace of mind.</Text>
        </View>
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.white }, scrollContent: { flexGrow: 1 }, safeArea: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20 },
  content: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignItems: 'center', justifyContent: 'center' }, logo: { width: 92, height: 92 }, brand: { color: Palette.text, fontSize: 30, fontWeight: '800', marginTop: 8 },
  mascotStage: { width: '100%', height: Platform.OS === 'web' ? 310 : 280, alignItems: 'center', justifyContent: 'center', marginVertical: 5 }, pinkCircle: { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: Palette.softPink }, mascot: { width: 235, height: 280 },
  title: { color: Palette.text, fontSize: 31, lineHeight: 38, fontWeight: '800', textAlign: 'center', maxWidth: 440 }, description: { color: Palette.textSecondary, fontSize: 17, lineHeight: 25, textAlign: 'center', maxWidth: 490, marginTop: 14 },
  button: { alignSelf: 'stretch', marginTop: 30 }, reassurance: { color: Palette.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 17 },
});
