import { PropsWithChildren, ReactNode } from 'react';
import { Platform, ScrollView, ScrollViewProps, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardSafeFormScreen } from '@/components/keyboard-safe-form-screen';
import { MeddyHeader } from '@/components/meddy-header';
import { BottomTabInset, MaxContentWidth, Palette } from '@/constants/theme';
import { FontFamily } from '@/constants/typography';

type ScreenShellProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  keyboardSafe?: boolean;
  onBack?: () => void;
  rightAction?: ReactNode;
  refreshControl?: ScrollViewProps['refreshControl'];
}>;

export function ScreenShell({ title, subtitle, children, keyboardSafe = false, onBack, rightAction, refreshControl }: ScreenShellProps) {
  const insets = useSafeAreaInsets();
  const outerStyle = [styles.outer, { paddingTop: Math.max(insets.top, 20) + 12, paddingBottom: (Platform.OS === 'web' ? 100 : BottomTabInset) + insets.bottom + 28 }];
  const content = (
    <View style={styles.content}>
      <MeddyHeader onBack={onBack} rightAction={rightAction} />
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );

  if (keyboardSafe) {
    return <KeyboardSafeFormScreen contentStyle={outerStyle} safeAreaEdges={['left', 'right']}>{content}</KeyboardSafeFormScreen>;
  }

  return <ScrollView style={styles.scroll} contentContainerStyle={outerStyle} refreshControl={refreshControl}>{content}</ScrollView>;
}

export const sharedStyles = StyleSheet.create({
  card: {
    backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.border,
    borderRadius: 24, padding: 20,
    ...Platform.select({
      web: { boxShadow: '0 6px 14px rgba(125, 62, 81, 0.07)' },
      default: { shadowColor: '#7D3E51', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
    }),
  },
  sectionTitle: { color: Palette.text, fontSize: 21, lineHeight: 27, fontFamily: FontFamily.extraBold, marginTop: 28, marginBottom: 14 },
});

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Palette.white }, outer: { alignItems: 'center', paddingHorizontal: 20 },
  content: { width: '100%', maxWidth: MaxContentWidth }, title: { color: Palette.text, fontSize: 32, lineHeight: 39, fontFamily: FontFamily.extraBold },
  subtitle: { color: Palette.textSecondary, fontSize: 17, lineHeight: 25, marginTop: 5, marginBottom: 22, fontFamily: FontFamily.regular },
});
