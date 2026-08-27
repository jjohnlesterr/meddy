import '@/global.css';

import { Platform } from 'react-native';

export const Palette = {
  white: '#FFFFFF', softPink: '#FFF6F9', primaryPink: '#F28BA8', strongPink: '#E96F93',
  lightPink: '#FCE1E9', text: '#2B2B2B', textSecondary: '#737373', border: '#F1DCE3',
  success: '#73B98C', warning: '#E8AA55', danger: '#DF7070',
} as const;

export const Colors = {
  light: {
    text: Palette.text, background: Palette.white, backgroundElement: Palette.softPink,
    backgroundSelected: Palette.lightPink, textSecondary: Palette.textSecondary,
  },
  dark: {
    text: Palette.text, background: Palette.white, backgroundElement: Palette.softPink,
    backgroundSelected: Palette.lightPink, textSecondary: Palette.textSecondary,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 58, android: 82 }) ?? 0;
export const MaxContentWidth = 720;
