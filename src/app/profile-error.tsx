import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MeddyButton } from '@/components/meddy-button';
import { MeddyHeader } from '@/components/meddy-header';
import { MeddyMascot } from '@/components/meddy-mascot';
import { Palette } from '@/constants/theme';
import { useAppState } from '@/context/app-state';

export default function ProfileErrorScreen() {
  const { logout, profileError, refreshProfile } = useAppState();
  const [loading, setLoading] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  async function retry() {
    setLoading(true);
    await refreshProfile();
    setLoading(false);
  }

  async function signOut() {
    setLoading(true);
    const result = await logout();
    setLogoutError(result.error ?? '');
    setLoading(false);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <MeddyHeader />
      <View style={styles.content}>
        <View style={styles.card}>
          <MeddyMascot state="caring" style={styles.mascot} />
          <Text style={styles.title}>We couldn’t load your profile.</Text>
          <Text style={styles.message}>{profileError || 'Please check your connection and try again.'}</Text>
          {logoutError ? <Text accessibilityRole="alert" style={styles.error}>{logoutError}</Text> : null}
          <View style={styles.actions}>
            <MeddyButton label={loading ? 'Trying again…' : 'Try Again'} onPress={retry} disabled={loading} />
            <MeddyButton label="Log Out" onPress={signOut} disabled={loading} variant="secondary" />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.white, paddingHorizontal: 20 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 24 },
  card: { width: '100%', maxWidth: 480, alignItems: 'center', backgroundColor: Palette.softPink, borderWidth: 1, borderColor: Palette.border, borderRadius: 28, padding: 26 }, mascot: { width: 180, height: 205 },
  title: { color: Palette.text, fontSize: 23, lineHeight: 30, fontWeight: '800', textAlign: 'center' }, message: { color: Palette.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 }, error: { color: Palette.danger, fontSize: 14, marginTop: 12 }, actions: { alignSelf: 'stretch', gap: 11, marginTop: 24 },
});
