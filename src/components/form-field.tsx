import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { Palette } from '@/constants/theme';

type FormFieldProps = TextInputProps & {
  label: string;
  showPasswordToggle?: boolean;
};

export function FormField({ label, secureTextEntry, showPasswordToggle = false, style, ...props }: FormFieldProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const hasPasswordToggle = showPasswordToggle && secureTextEntry;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputShell}>
        <TextInput
          {...props}
          accessibilityLabel={label}
          placeholderTextColor="#A49A9D"
          secureTextEntry={Boolean(secureTextEntry && !isPasswordVisible)}
          style={[styles.input, style]}
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
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { color: Palette.text, fontSize: 15, fontWeight: '700' },
  inputShell: { minHeight: 56, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Palette.border, borderRadius: 16, backgroundColor: Palette.white, overflow: 'hidden' },
  input: { minHeight: 54, flex: 1, color: Palette.text, fontSize: 17, paddingHorizontal: 16 },
  visibilityButton: { width: 52, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  visibilityFallback: { color: Palette.strongPink, fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.6 },
});
