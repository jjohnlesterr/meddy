import { ReactNode } from 'react';
import { Image, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { Palette } from '@/constants/theme';
import { FontFamily } from '@/constants/typography';

const meddyWordmark = require('@/assets/images/meddy/logo with name.png');

type MeddyHeaderProps = {
  onBack?: () => void;
  rightAction?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function MeddyHeader({ onBack, rightAction, style }: MeddyHeaderProps) {
  return (
    <View style={[styles.header, style]}>
      <View style={styles.left}>
        {onBack ? (
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
        ) : null}
        <Image accessibilityLabel="Meddy" resizeMode="contain" source={meddyWordmark} style={styles.wordmark} />
      </View>
      {rightAction ? <View style={styles.right}>{rightAction}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Palette.white, marginBottom: 18 },
  left: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  wordmark: { width: 136, height: 46 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 6, borderRadius: 14 },
  backIcon: { color: Palette.text, fontSize: 34, lineHeight: 38, fontFamily: FontFamily.medium },
  right: { minHeight: 44, alignItems: 'flex-end', justifyContent: 'center', marginLeft: 12 },
  pressed: { opacity: 0.6 },
});
