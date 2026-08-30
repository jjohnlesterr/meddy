import type { TextStyle } from 'react-native';

export const FontFamily = {
  regular: 'NunitoSans_400Regular',
  medium: 'NunitoSans_500Medium',
  semiBold: 'NunitoSans_600SemiBold',
  bold: 'NunitoSans_700Bold',
  extraBold: 'NunitoSans_800ExtraBold',
} as const;

export type TypographyVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'subtitle'
  | 'button'
  | 'body'
  | 'bodyMedium'
  | 'caption';

// Each fontFamily below IS a specific static weight (Nunito Sans ships one file
// per weight, not a variable font) — never pair a variant with an explicit
// fontWeight override, since layering synthetic bolding on an already-bold
// glyph clips/distorts text on Android.
export const Typography: Record<TypographyVariant, TextStyle> = {
  display: { fontFamily: FontFamily.extraBold, fontSize: 31, lineHeight: 38 },
  title: { fontFamily: FontFamily.extraBold, fontSize: 24, lineHeight: 30 },
  heading: { fontFamily: FontFamily.bold, fontSize: 20, lineHeight: 26 },
  subtitle: { fontFamily: FontFamily.semiBold, fontSize: 17, lineHeight: 22 },
  button: { fontFamily: FontFamily.bold, fontSize: 17, lineHeight: 22 },
  bodyMedium: { fontFamily: FontFamily.medium, fontSize: 15, lineHeight: 21 },
  body: { fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18 },
};
