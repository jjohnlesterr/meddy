import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { Palette } from '@/constants/theme';

type MeddyButtonProps = { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean; style?: ViewStyle };

export function MeddyButton({ label, onPress, variant = 'primary', disabled, style }: MeddyButtonProps) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, styles[variant], style, pressed && styles.pressed, disabled && styles.disabled]}>
      <Text style={[styles.label, variant !== 'primary' && styles.secondaryLabel, variant === 'danger' && styles.dangerLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, borderWidth: 1 },
  primary: { backgroundColor: Palette.strongPink, borderColor: Palette.strongPink }, secondary: { backgroundColor: Palette.white, borderColor: Palette.border }, danger: { backgroundColor: Palette.white, borderColor: '#F3CACA' },
  label: { color: Palette.white, fontSize: 17, fontWeight: '800' }, secondaryLabel: { color: Palette.strongPink }, dangerLabel: { color: Palette.danger },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] }, disabled: { opacity: 0.5 },
});
