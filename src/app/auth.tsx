import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MeddyButton } from '@/components/meddy-button';
import { MeddyLogo } from '@/components/meddy-logo';
import { MeddyMascot } from '@/components/meddy-mascot';
import { Palette } from '@/constants/theme';

export default function AuthEntryScreen() {
  const router = useRouter();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scroll}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <MeddyLogo style={styles.logo} />
          <MeddyMascot state="default" style={styles.mascot} />
          <Text style={styles.title}>Welcome to Meddy</Text>
          <Text style={styles.subtitle}>A gentle place to manage medicines and stay connected with your care team.</Text>
          <View style={styles.actions}>
            <MeddyButton label="Log In" onPress={() => router.push('/login' as Href)} />
            <MeddyButton label="Create Account" onPress={() => router.push('/signup' as Href)} variant="secondary" />
          </View>
        </View>
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.white }, scroll: { flexGrow: 1 }, safeArea: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 24 },
  content: { flex: 1, width: '100%', maxWidth: 520, alignItems: 'center', justifyContent: 'center' }, logo: { width: 84, height: 84 }, mascot: { width: 220, height: 260, marginTop: 10 },
  title: { color: Palette.text, fontSize: 31, lineHeight: 38, fontWeight: '800', textAlign: 'center' }, subtitle: { color: Palette.textSecondary, fontSize: 16, lineHeight: 24, textAlign: 'center', maxWidth: 440, marginTop: 10 },
  actions: { alignSelf: 'stretch', gap: 12, marginTop: 30 },
});
