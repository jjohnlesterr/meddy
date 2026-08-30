import { Text, type TextProps } from 'react-native';

import { Typography, type TypographyVariant } from '@/constants/typography';

type AppTextProps = TextProps & { variant?: TypographyVariant };

/** Text with Meddy's global Nunito Sans typography baked in. `style` overrides win after the variant. */
export function AppText({ variant = 'body', style, ...props }: AppTextProps) {
  return <Text {...props} style={[Typography[variant], style]} />;
}
