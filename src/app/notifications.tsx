import type { Href } from 'expo-router';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { MeddyButton } from '@/components/meddy-button';
import { MeddyMascot } from '@/components/meddy-mascot';
import { ScreenShell, sharedStyles } from '@/components/screen-shell';
import { Palette } from '@/constants/theme';
import { FontFamily } from '@/constants/typography';
import { useMeddyActivity, type MeddyFeedItem } from '@/context/activity-context';
import type { MeddyActivityType } from '@/lib/meddy-activity';

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

type FeedFilter = 'all' | 'medicines' | 'care_circle' | 'reminders';

const FILTERS: { id: FeedFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'medicines', label: 'Medicines' },
  { id: 'care_circle', label: 'Care Circle' },
  { id: 'reminders', label: 'Reminders' },
];

const REMINDER_TYPES = new Set<MeddyActivityType>(['medicine_reminder', 'medicine_snoozed']);
const MEDICINE_TYPES = new Set<MeddyActivityType>([
  'medicine_reminder',
  'medicine_snoozed',
  'shared_medicine_added',
  'shared_medicine_updated',
]);
const CARE_CIRCLE_TYPES = new Set<MeddyActivityType>([
  'care_circle_created',
  'care_circle_join_requested',
  'care_circle_joined',
  'care_circle_left',
  'care_circle_request_accepted',
  'care_circle_request_incoming',
]);

function matchesFilter(type: MeddyActivityType, filter: FeedFilter) {
  if (filter === 'all') return true;
  if (filter === 'reminders') return REMINDER_TYPES.has(type);
  if (filter === 'medicines') return MEDICINE_TYPES.has(type);
  return CARE_CIRCLE_TYPES.has(type);
}

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

function MenuOption({ label, onPress, destructive }: { label: string; onPress: () => void; destructive?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.menuOption, pressed && styles.pressed]}>
      <Text style={[styles.menuOptionText, destructive && styles.menuOptionTextDanger]}>{label}</Text>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { items, refresh, markAllSeen, dismiss, clearRead, setRead } = useMeddyActivity();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [itemMenuId, setItemMenuId] = useState<string | null>(null);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingClearRead, setPendingClearRead] = useState(false);
  const [detailsItem, setDetailsItem] = useState<MeddyFeedItem | null>(null);

  const filteredItems = useMemo(() => items.filter((item) => matchesFilter(item.type, filter)), [items, filter]);
  const hasReadItems = useMemo(() => filteredItems.some((item) => item.read), [filteredItems]);
  const menuItem = useMemo(() => filteredItems.find((item) => item.id === itemMenuId) ?? null, [filteredItems, itemMenuId]);

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

  function handleViewDetails(item: MeddyFeedItem) {
    setItemMenuId(null);
    if (item.href) {
      openItem(item);
    } else {
      setDetailsItem(item);
    }
  }

  function handleToggleRead(item: MeddyFeedItem) {
    setItemMenuId(null);
    void setRead(item.id, !item.read);
  }

  function handleConfirmDelete() {
    if (pendingDeleteId) void dismiss(pendingDeleteId);
    setPendingDeleteId(null);
  }

  function handleConfirmClearRead() {
    void clearRead();
    setPendingClearRead(false);
  }

  return (
    <ScreenShell
      title="Notifications"
      onBack={() => router.back()}
      rightAction={
        <Pressable
          accessibilityLabel="Notification options"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => setPageMenuOpen(true)}
          style={({ pressed }) => [styles.pageMenuButton, pressed && styles.pressed]}>
          <Text style={styles.pageMenuButtonText}>⋮</Text>
        </Pressable>
      }
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handlePullToRefresh}
          tintColor={Palette.strongPink}
          colors={[Palette.strongPink]}
        />
      }>
      <View style={styles.filterRow}>
        {FILTERS.map((option) => {
          const selected = filter === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => setFilter(option.id)}
              style={({ pressed }) => [styles.filterChip, selected && styles.filterChipSelected, pressed && styles.pressed]}>
              <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {filteredItems.length === 0 ? (
        <View style={styles.emptyCard}>
          <MeddyMascot state="default" style={styles.emptyMascot} />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyText}>Important updates will appear here.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filteredItems.map((item) => {
            const interactive = Boolean(item.href);
            return (
              <View key={item.id} style={[sharedStyles.card, styles.row, !item.read && styles.rowUnread]}>
                <Pressable
                  accessibilityRole={interactive ? 'button' : undefined}
                  disabled={!interactive}
                  onPress={() => openItem(item)}
                  style={({ pressed }) => [styles.rowContent, pressed && interactive && styles.pressed]}>
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
                <Pressable
                  accessibilityLabel={`More options for ${item.title}`}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => setItemMenuId(item.id)}
                  style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}>
                  <Text style={styles.moreButtonText}>⋮</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {/* Per-notification overflow menu */}
      <Modal transparent animationType="fade" visible={menuItem !== null} onRequestClose={() => setItemMenuId(null)}>
        <View style={styles.menuOverlay}>
          <Pressable accessibilityLabel="Close menu" accessibilityRole="button" onPress={() => setItemMenuId(null)} style={StyleSheet.absoluteFill} />
          {menuItem ? (
            <View accessibilityViewIsModal style={styles.menuCard}>
              <Text numberOfLines={1} style={styles.menuTitle}>{menuItem.title}</Text>
              <MenuOption label="View details" onPress={() => handleViewDetails(menuItem)} />
              <MenuOption label={menuItem.read ? 'Mark as unread' : 'Mark as read'} onPress={() => handleToggleRead(menuItem)} />
              <MenuOption label="Delete notification" destructive onPress={() => { setItemMenuId(null); setPendingDeleteId(menuItem.id); }} />
              <MenuOption label="Cancel" onPress={() => setItemMenuId(null)} />
            </View>
          ) : null}
        </View>
      </Modal>

      {/* Page-level overflow menu */}
      <Modal transparent animationType="fade" visible={pageMenuOpen} onRequestClose={() => setPageMenuOpen(false)}>
        <View style={styles.menuOverlayTop}>
          <Pressable accessibilityLabel="Close menu" accessibilityRole="button" onPress={() => setPageMenuOpen(false)} style={StyleSheet.absoluteFill} />
          <View accessibilityViewIsModal style={styles.menuCard}>
            {hasReadItems ? (
              <MenuOption label="Clear read notifications" destructive onPress={() => { setPageMenuOpen(false); setPendingClearRead(true); }} />
            ) : (
              <Text style={styles.menuEmptyText}>No read notifications to clear</Text>
            )}
            <MenuOption label="Cancel" onPress={() => setPageMenuOpen(false)} />
          </View>
        </View>
      </Modal>

      {/* Delete confirmation */}
      <Modal transparent animationType="fade" visible={pendingDeleteId !== null} onRequestClose={() => setPendingDeleteId(null)}>
        <View style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete notification?</Text>
            <Text style={styles.modalText}>This only removes it from your notification history.</Text>
            <View style={styles.modalActions}>
              <MeddyButton label="Cancel" onPress={() => setPendingDeleteId(null)} variant="secondary" style={styles.modalButton} />
              <MeddyButton label="Delete" onPress={handleConfirmDelete} variant="danger" style={styles.modalButton} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Clear-read confirmation */}
      <Modal transparent animationType="fade" visible={pendingClearRead} onRequestClose={() => setPendingClearRead(false)}>
        <View style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.modalCard}>
            <Text style={styles.modalTitle}>Clear read notifications?</Text>
            <Text style={styles.modalText}>All notifications you have already read will be removed from this list.</Text>
            <View style={styles.modalActions}>
              <MeddyButton label="Cancel" onPress={() => setPendingClearRead(false)} variant="secondary" style={styles.modalButton} />
              <MeddyButton label="Clear" onPress={handleConfirmClearRead} variant="danger" style={styles.modalButton} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Details fallback for items with no destination screen */}
      <Modal transparent animationType="fade" visible={detailsItem !== null} onRequestClose={() => setDetailsItem(null)}>
        <View style={styles.modalBackdrop}>
          {detailsItem ? (
            <View accessibilityViewIsModal style={styles.modalCard}>
              <View style={styles.detailsIconWrap}><Text style={styles.icon}>{ICONS[detailsItem.type] ?? '•'}</Text></View>
              <Text style={styles.modalTitle}>{detailsItem.title}</Text>
              {detailsItem.body ? <Text style={styles.modalText}>{detailsItem.body}</Text> : null}
              <Text style={styles.detailsTime}>{new Date(detailsItem.createdAt).toLocaleString()}</Text>
              <MeddyButton label="Close" onPress={() => setDetailsItem(null)} variant="secondary" style={styles.detailsCloseButton} />
            </View>
          ) : null}
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  pageMenuButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  pageMenuButtonText: { color: Palette.text, fontSize: 22, lineHeight: 24 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  filterChip: { minHeight: 40, justifyContent: 'center', borderWidth: 1, borderColor: Palette.border, borderRadius: 999, backgroundColor: Palette.white, paddingHorizontal: 16 },
  filterChipSelected: { borderColor: Palette.strongPink, backgroundColor: Palette.softPink },
  filterChipText: { color: Palette.textSecondary, fontFamily: FontFamily.bold, fontSize: 14 },
  filterChipTextSelected: { color: Palette.strongPink },
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
  emptyTitle: { color: Palette.text, fontFamily: FontFamily.extraBold, fontSize: 22, lineHeight: 29, textAlign: 'center', marginTop: 4 },
  emptyText: { color: Palette.textSecondary, fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  list: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'stretch', padding: 0 },
  rowUnread: { borderColor: Palette.lightPink, backgroundColor: Palette.softPink },
  rowContent: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', padding: 16 },
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
  title: { color: Palette.text, fontFamily: FontFamily.extraBold, fontSize: 16, lineHeight: 22 },
  text: { color: Palette.textSecondary, fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20, marginTop: 3 },
  time: { color: Palette.textSecondary, fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 17, marginTop: 6 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Palette.strongPink, marginLeft: 8, marginTop: 4 },
  moreButton: { width: 44, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: Palette.border },
  moreButtonText: { color: Palette.textSecondary, fontSize: 20, lineHeight: 22 },

  menuOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(43, 43, 43, 0.3)', padding: 22 },
  menuOverlayTop: { flex: 1, alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 96, backgroundColor: 'rgba(43, 43, 43, 0.28)' },
  menuCard: { alignSelf: 'center', width: '100%', maxWidth: 360, borderRadius: 22, backgroundColor: Palette.white, padding: 10 },
  menuTitle: { color: Palette.textSecondary, fontSize: 12, lineHeight: 17, fontFamily: FontFamily.extraBold, letterSpacing: 0.5, paddingHorizontal: 12, paddingVertical: 8 },
  menuEmptyText: { color: Palette.textSecondary, fontSize: 14, lineHeight: 20, fontFamily: FontFamily.regular, paddingHorizontal: 13, paddingVertical: 12 },
  menuOption: { minHeight: 50, justifyContent: 'center', borderRadius: 14, paddingHorizontal: 13 },
  menuOptionText: { color: Palette.text, fontSize: 16, lineHeight: 22, fontFamily: FontFamily.bold },
  menuOptionTextDanger: { color: Palette.danger },

  modalBackdrop: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(43, 43, 43, 0.3)', padding: 22 },
  modalCard: { alignSelf: 'center', width: '100%', maxWidth: 400, borderRadius: 26, backgroundColor: Palette.white, padding: 22 },
  modalTitle: { color: Palette.text, fontFamily: FontFamily.extraBold, fontSize: 19, lineHeight: 25 },
  modalText: { color: Palette.textSecondary, fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 21, marginTop: 8 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalButton: { flex: 1, minHeight: 52, paddingHorizontal: 12 },
  detailsIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: Palette.lightPink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  detailsTime: { color: Palette.textSecondary, fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 17, marginTop: 12 },
  detailsCloseButton: { marginTop: 18 },
});
