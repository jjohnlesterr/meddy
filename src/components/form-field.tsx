import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { Palette } from '@/constants/theme';
import { Typography } from '@/constants/typography';

type FormFieldProps = TextInputProps & {
  label: string;
  showPasswordToggle?: boolean;
  /** Shows a subtle "X / maxLength" counter under the field. Only meaningful together with `maxLength` — meant for longer fields (e.g. Instructions, Notes), not every short field. */
  showCharacterCount?: boolean;
};

export function FormField({ label, secureTextEntry, showPasswordToggle = false, showCharacterCount = false, maxLength, style, value, ...props }: FormFieldProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const hasPasswordToggle = showPasswordToggle && secureTextEntry;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputShell}>
        <TextInput
          {...props}
          accessibilityLabel={label}
          maxLength={maxLength}
          placeholderTextColor="#A49A9D"
          secureTextEntry={Boolean(secureTextEntry && !isPasswordVisible)}
          style={[styles.input, style]}
          value={value}
        />
        {hasPasswordToggle ? (
          <Pressable
            accessibilityLabel={isPasswordVisible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            accessibilityRole="button"
            accessibilityState={{ expanded: isPasswordVisible }}
            hitSlop={4}
            onPress={() => setIsPasswordVisible((current) => !current)}
            style={({ pressed }) => [styles.visibilityButton, pressed && styles.pressed]}>
            <SymbolView
              fallback={<Text style={styles.visibilityFallback}>{isPasswordVisible ? 'Hide' : 'Show'}</Text>}
              name={{
                ios: isPasswordVisible ? 'eye.slash' : 'eye',
                android: isPasswordVisible ? 'visibility_off' : 'visibility',
                web: isPasswordVisible ? 'visibility_off' : 'visibility',
              }}
              size={23}
              tintColor={Palette.strongPink}
            />
          </Pressable>
        ) : null}
      </View>
      {showCharacterCount && maxLength ? (
        <Text style={styles.counter}>{(value?.length ?? 0)} / {maxLength}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { ...Typography.subtitle, fontSize: 15, lineHeight: 20, color: Palette.text },
  inputShell: { minHeight: 56, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Palette.border, borderRadius: 16, backgroundColor: Palette.white, overflow: 'hidden' },
  input: { ...Typography.body, minHeight: 54, flex: 1, color: Palette.text, fontSize: 17, lineHeight: 22, paddingHorizontal: 16 },
  visibilityButton: { width: 52, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  visibilityFallback: { fontFamily: Typography.button.fontFamily, color: Palette.strongPink, fontSize: 12 },
  counter: { ...Typography.caption, color: Palette.textSecondary, alignSelf: 'flex-end' },
  pressed: { opacity: 0.6 },
});
