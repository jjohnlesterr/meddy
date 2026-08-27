import { Image, ImageStyle, StyleProp } from 'react-native';

export function MeddyLogo({ style }: { style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      accessibilityLabel="Meddy app logo"
      resizeMode="contain"
      source={require('@/assets/branding/meddy-logo.png')}
      style={style}
    />
  );
}
