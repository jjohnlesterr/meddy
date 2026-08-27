import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { Palette } from '@/constants/theme';

export function FormField({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor="#A49A9D" style={styles.input} {...props} /></View>;
}

const styles = StyleSheet.create({
  field: { gap: 8 }, label: { color: Palette.text, fontSize: 15, fontWeight: '700' },
  input: { minHeight: 56, borderWidth: 1, borderColor: Palette.border, borderRadius: 16, backgroundColor: Palette.white, color: Palette.text, fontSize: 17, paddingHorizontal: 16 },
});
