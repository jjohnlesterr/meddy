import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette } from '@/constants/theme';
import { FontFamily } from '@/constants/typography';
import { formatScheduleSummary, medicineDosageLabel } from '@/lib/medicines';
import type { Medicine } from '@/types/medicine';

type MedicineCardProps = {
  medicine: Medicine;
  onPress?: () => void;
};

export function MedicineCard({ medicine, onPress }: MedicineCardProps) {
  const dosage = medicineDosageLabel(medicine);
  const schedule = medicine.schedules[0];
  const content = (
    <>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.name}>{medicine.name}</Text>
          <Text style={styles.details}>{[dosage, medicine.form].filter(Boolean).join(' · ')}</Text>
        </View>
        <View style={[styles.status, !medicine.active && styles.inactiveStatus]}>
          <Text style={[styles.statusText, !medicine.active && styles.inactiveStatusText]}>{medicine.active ? 'Active' : 'Inactive'}</Text>
        </View>
      </View>
      <View style={styles.scheduleRow}>
        <Text style={styles.clock}>◷</Text>
        <Text style={styles.time}>{formatScheduleSummary(schedule)}</Text>
        {onPress ? <Text style={styles.chevron}>›</Text> : null}
      </View>
      {medicine.instructions ? <Text numberOfLines={2} style={styles.instructions}>{medicine.instructions}</Text> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityLabel={`Open details for ${medicine.name}`}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        {content}
      </Pressable>
    );
  }

  return <View style={styles.card}>{content}</View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: Palette.border, borderRadius: 22, backgroundColor: Palette.white, padding: 17 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headingCopy: { flex: 1 },
  name: { color: Palette.text, fontFamily: FontFamily.extraBold, fontSize: 19, lineHeight: 25 },
  details: { color: Palette.textSecondary, fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20, marginTop: 3 },
  status: { borderRadius: 999, backgroundColor: '#EAF7EF', paddingHorizontal: 10, paddingVertical: 5 },
  inactiveStatus: { backgroundColor: '#F3F0F1' },
  statusText: { color: '#3E8057', fontFamily: FontFamily.extraBold, fontSize: 12, lineHeight: 16 },
  inactiveStatusText: { color: Palette.textSecondary },
  scheduleRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', marginTop: 11 },
  clock: { color: Palette.strongPink, fontFamily: FontFamily.regular, fontSize: 20, marginRight: 7 },
  time: { flex: 1, color: Palette.text, fontFamily: FontFamily.extraBold, fontSize: 16, lineHeight: 22 },
  chevron: { color: Palette.strongPink, fontFamily: FontFamily.regular, fontSize: 27, lineHeight: 28 },
  instructions: { color: Palette.textSecondary, fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20, marginTop: 5 },
  pressed: { opacity: 0.68, backgroundColor: Palette.softPink },
});
