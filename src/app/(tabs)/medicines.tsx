import { StyleSheet, Text, View } from 'react-native';

import { MeddyButton } from '@/components/meddy-button';
import { MeddyMascot } from '@/components/meddy-mascot';
import { ScreenShell } from '@/components/screen-shell';
import { Palette } from '@/constants/theme';

export default function MedicinesScreen() {
  return (
    <ScreenShell title="My Medicines" subtitle="Your medicines and schedules will appear here.">
      <View style={styles.emptyCard}>
        <View style={styles.mascotStage}><MeddyMascot state="caring" style={styles.mascot} /></View>
        <Text style={styles.title}>You haven’t added any medicines yet.</Text>
        <Text style={styles.text}>Add your medicines so Meddy can help you remember when to take them.</Text>
        <MeddyButton label="+  Add Medicine" onPress={() => {}} style={styles.button} />
      </View>
      <View style={styles.tip}><Text style={styles.tipTitle}>What you’ll need</Text><Text style={styles.tipText}>Medicine name, dose, and the time you take it. You can update these details anytime.</Text></View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  emptyCard: { alignItems: 'center', backgroundColor: Palette.softPink, borderWidth: 1, borderColor: Palette.border, borderRadius: 30, padding: 24 }, mascotStage: { height: 230, width: '100%', alignItems: 'center', justifyContent: 'center' }, mascot: { width: 205, height: 235 },
  title: { color: Palette.text, fontSize: 23, lineHeight: 30, fontWeight: '800', textAlign: 'center', maxWidth: 420 }, text: { color: Palette.textSecondary, fontSize: 16, lineHeight: 24, textAlign: 'center', maxWidth: 460, marginTop: 10 }, button: { alignSelf: 'stretch', marginTop: 24 },
  tip: { marginTop: 20, padding: 20, borderRadius: 22, borderWidth: 1, borderColor: Palette.border }, tipTitle: { color: Palette.text, fontSize: 16, fontWeight: '800' }, tipText: { color: Palette.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 6 },
});
