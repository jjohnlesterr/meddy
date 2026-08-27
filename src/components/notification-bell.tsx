import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Palette } from '@/constants/theme';
import { useMeddyActivity } from '@/context/activity-context';

/**
 * Top-right header bell for authenticated main screens. Shows a small pink dot
 * when there is real unread Meddy activity; opens `/notifications` on tap.
 */
export function NotificationBell() {
  const router = useRouter();
  const { unreadCount } = useMeddyActivity();
  const hasUnread = unreadCount > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hasUnread ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      hitSlop={10}
      onPress={() => router.push('/notifications' as Href)}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <View style={styles.bell}>
        <View style={styles.body} />
        <View style={styles.rim} />
        <View style={styles.clapper} />
      </View>
      {hasUnread ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  pressed: { opacity: 0.55 },
  bell: { width: 26, alignItems: 'center', justifyContent: 'center' },
  body: {
    width: 19,
    height: 17,
    borderWidth: 2.4,
    borderColor: Palette.text,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    borderBottomWidth: 0,
  },
  rim: { width: 25, height: 2.6, borderRadius: 2, backgroundColor: Palette.text, marginTop: -0.5 },
  clapper: { width: 6, height: 6, borderRadius: 3, backgroundColor: Palette.text, marginTop: 1.5 },
  dot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: Palette.strongPink,
    borderWidth: 2,
    borderColor: Palette.white,
  },
});
