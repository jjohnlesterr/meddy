import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { Palette } from '@/constants/theme';
import { Typography } from '@/constants/typography';

type MeddyButtonProps = { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean; style?: ViewStyle };

export function MeddyButton({ label, onPress, variant = 'primary', disabled, style }: MeddyButtonProps) {
  const content = (
    <Text style={[styles.label, variant !== 'primary' && styles.secondaryLabel, variant === 'danger' && styles.dangerLabel]}>{label}</Text>
  );

  if (variant === 'primary') {
    // The gradient's own borderRadius must match the Pressable's, not just rely on the
    // parent's overflow:hidden — Android does not reliably clip a native gradient view to a
    // parent's rounded corners, which was leaving custom-radius buttons (e.g. Home's Care
    // Circle actions) looking like unrounded rectangles. Only the radius is forwarded, not
    // the whole override style, so layout props like alignSelf/margin stay on the Pressable.
    const radius = style?.borderRadius ?? styles.button.borderRadius;
    return (
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [styles.button, style, pressed && styles.pressed, disabled && styles.disabled]}>
        <LinearGradient
          colors={[Palette.primaryPink, Palette.strongPink]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradientFill, { borderRadius: radius }]}>
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, styles[variant], style, pressed && styles.pressed, disabled && styles.disabled]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent', overflow: 'hidden' },
  gradientFill: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  secondary: { backgroundColor: Palette.white, borderColor: Palette.border, paddingHorizontal: 20 }, danger: { backgroundColor: Palette.white, borderColor: '#F3CACA', paddingHorizontal: 20 },
  label: { ...Typography.button, color: Palette.white }, secondaryLabel: { color: Palette.strongPink }, dangerLabel: { color: Palette.danger },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] }, disabled: { opacity: 0.5 },
});
