import type { Href } from 'expo-router';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { MeddyMascot } from '@/components/meddy-mascot';
import { ScreenShell, sharedStyles } from '@/components/screen-shell';
import { Palette } from '@/constants/theme';
import { useMeddyActivity, type MeddyFeedItem } from '@/context/activity-context';

const ICONS: Record<MeddyFeedItem['type'], string> = {
  medicine_reminder: '⏰',
  medicine_snoozed: '💤',
  shared_medicine_added: '＋',
  shared_medicine_updated: '✎',
  care_circle_created: '♡',
  care_circle_join_requested: '⏳',
  care_circle_joined: '♡',
  care_circle_left: '–',
  care_circle_request_accepted: '✓',
  care_circle_request_incoming: '👋',
};

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { items, refresh, markAllSeen } = useMeddyActivity();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      // Clear the unread dot shortly after the list is actually on screen.
      const timer = setTimeout(() => void markAllSeen(), 600);
      return () => clearTimeout(timer);
    }, [markAllSeen, refresh]),
  );

  const handlePullToRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [refresh]);

  const openItem = useCallback(
    (item: MeddyFeedItem) => {
      if (!item.href) return;
      try {
        router.push(item.href as Href);
      } catch {
        // Destination was deleted or is otherwise unreachable — stay put.
      }
    },
    [router],
  );

  return (
    <ScreenShell
      title="Notifications"
      onBack={() => router.back()}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handlePullToRefresh}
          tintColor={Palette.strongPink}
          colors={[Palette.strongPink]}
        />
      }>
      {items.length === 0 ? (
        <View style={styles.emptyCard}>
          <MeddyMascot state="default" style={styles.emptyMascot} />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyText}>Important updates will appear here.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {items.map((item) => {
            const interactive = Boolean(item.href);
            return (
              <Pressable
                key={item.id}
                accessibilityRole={interactive ? 'button' : undefined}
                disabled={!interactive}
                onPress={() => openItem(item)}
                style={({ pressed }) => [
                  sharedStyles.card,
                  styles.row,
                  !item.read && styles.rowUnread,
                  pressed && interactive && styles.pressed,
                ]}>
                <View style={styles.iconWrap}>
                  <Text style={styles.icon}>{ICONS[item.type] ?? '•'}</Text>
                </View>
                <View style={styles.body}>
                  <Text style={styles.title}>{item.title}</Text>
                  {item.body ? <Text style={styles.text}>{item.body}</Text> : null}
                  <Text style={styles.time}>{relativeTime(item.createdAt)}</Text>
                </View>
                {!item.read ? <View style={styles.unreadDot} /> : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    alignItems: 'center',
    backgroundColor: Palette.softPink,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: 28,
    marginTop: 8,
  },
  emptyMascot: { width: 180, height: 200 },
  emptyTitle: { color: Palette.text, fontSize: 22, lineHeight: 29, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  emptyText: { color: Palette.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  list: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start', padding: 16 },
  rowUnread: { borderColor: Palette.lightPink, backgroundColor: Palette.softPink },
  pressed: { opacity: 0.7 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Palette.lightPink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 18, color: Palette.strongPink },
  body: { flex: 1, marginLeft: 13 },
  title: { color: Palette.text, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  text: { color: Palette.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 3 },
  time: { color: Palette.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 6 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Palette.strongPink, marginLeft: 8, marginTop: 4 },
});
