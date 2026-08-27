import { Image, ImageStyle, StyleProp } from 'react-native';

export type MeddyState = 'default' | 'caring' | 'success' | 'reminder';

const meddyImages = {
  default: require('@/assets/images/meddy/default.png'),
  caring: require('@/assets/images/meddy/caring.png'),
  success: require('@/assets/images/meddy/success.png'),
  reminder: require('@/assets/images/meddy/reminder.png'),
};

export function MeddyMascot({ state = 'default', style }: { state?: MeddyState; style?: StyleProp<ImageStyle> }) {
  return <Image accessibilityLabel={`Meddy rabbit, ${state} state`} resizeMode="contain" source={meddyImages[state]} style={style} />;
}
