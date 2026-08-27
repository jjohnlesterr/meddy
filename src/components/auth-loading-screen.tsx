import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MeddyLogo } from '@/components/meddy-logo';
import { Palette } from '@/constants/theme';

export function AuthLoadingScreen({ message = 'Getting Meddy ready…' }: { message?: string }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <MeddyLogo style={styles.logo} />
        <ActivityIndicator color={Palette.strongPink} size="large" style={styles.spinner} />
        <Text style={styles.message}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.white, padding: 24 },
  card: { width: '100%', maxWidth: 420, alignItems: 'center', backgroundColor: Palette.softPink, borderWidth: 1, borderColor: Palette.border, borderRadius: 28, padding: 30 },
  logo: { width: 82, height: 82 }, spinner: { marginTop: 22 }, message: { color: Palette.text, fontSize: 17, lineHeight: 24, fontWeight: '700', textAlign: 'center', marginTop: 16 },
});
