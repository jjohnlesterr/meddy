import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { MeddyButton } from '@/components/meddy-button';
import { ScreenShell, sharedStyles } from '@/components/screen-shell';
import { Palette } from '@/constants/theme';
import { useAppState } from '@/context/app-state';
import { syncSharedCareCircleNotifications } from '@/lib/care-circle-notifications';
import {
  inspectScheduledMeddyNotifications,
  scheduleTestNotificationIn30Seconds,
  type ScheduledMeddyNotification,
} from '@/lib/medicine-notifications';
import { nativeNotificationsAvailable } from '@/lib/notification-runtime';
import type { ReminderSound } from '@/types/medicine';

const TEST_SOUNDS: { id: ReminderSound; label: string }[] = [
  { id: 'gentle_chime', label: 'Gentle Chime' },
  { id: 'soft_bell', label: 'Soft Bell' },
  { id: 'morning_tone', label: 'Morning Tone' },
];

// Development-only diagnostics screen. It is only registered as a route when
// __DEV__ is true (see src/app/_layout.tsx) and renders nothing in production.
export default function NotificationDiagnosticsScreen() {
  const router = useRouter();
  const { session } = useAppState();
  const userId = session?.user.id;
  const [items, setItems] = useState<ScheduledMeddyNotification[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const refreshList = useCallback(async () => {
    const result = await inspectScheduledMeddyNotifications(userId);
    setAvailable(result.available);
    setItems(result.items);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => void refreshList(), 0);
      return () => clearTimeout(timer);
    }, [refreshList]),
  );

  const runTest = useCallback(
    async (sound: ReminderSound) => {
      setBusy(true);
      setStatus(`Scheduling ${sound} test…`);
      try {
        const result = await scheduleTestNotificationIn30Seconds(sound);
        setStatus(
          result.scheduled
            ? `${sound} test scheduled on ${result.channelId}. Background the app; it fires in ~30s. (Sound plays on the ALARM stream — check alarm volume.)`
            : `${sound} test NOT scheduled: ${result.reason}.`,
        );
        await refreshList();
      } finally {
        setBusy(false);
      }
    },
    [refreshList],
  );

  const runSync = useCallback(async () => {
    if (!userId) return;
    setBusy(true);
    setStatus('Running shared reminder sync… check the Metro logs for "Shared sync result".');
    try {
      await syncSharedCareCircleNotifications(userId);
      await refreshList();
      setStatus('Shared reminder sync finished. See the list below and the Metro logs.');
    } finally {
      setBusy(false);
    }
  }, [refreshList, userId]);

  if (!__DEV__) {
    return (
      <ScreenShell title="Not available" onBack={() => router.back()}>
        <Text style={styles.body}>This screen is only available in development builds.</Text>
      </ScreenShell>
    );
  }

  const meddyReminders = items.filter((item) => item.scope !== 'other');

  return (
    <ScreenShell title="Notification diagnostics" subtitle="Development build only." onBack={() => router.back()}>
      <View style={styles.actions}>
        {TEST_SOUNDS.map((sound) => (
          <MeddyButton
            key={sound.id}
            label={`Test ${sound.label} in 30s`}
            onPress={() => void runTest(sound.id)}
            disabled={busy}
          />
        ))}
        <MeddyButton label="Run shared reminder sync now" onPress={() => void runSync()} disabled={busy || !userId} variant="secondary" />
        <MeddyButton label="Refresh scheduled list" onPress={() => void refreshList()} disabled={busy} variant="secondary" />
      </View>

      {status ? <Text style={styles.status}>{status}</Text> : null}

      <View style={[sharedStyles.card, styles.summary]}>
        <Text style={styles.summaryLine}>Native notifications available: {String(nativeNotificationsAvailable)}</Text>
        <Text style={styles.summaryLine}>getAllScheduledNotificationsAsync reachable: {available === null ? '…' : String(available)}</Text>
        <Text style={styles.summaryLine}>Total scheduled: {items.length}</Text>
        <Text style={styles.summaryLine}>Meddy reminders: {meddyReminders.length}</Text>
        <Text style={styles.summaryLine}>
          Care Circle reminders: {meddyReminders.filter((item) => item.scope === 'care_circle').length}
        </Text>
      </View>

      {meddyReminders.length === 0 ? (
        <View style={[sharedStyles.card, styles.summary]}>
          <Text style={styles.body}>
            No Meddy reminders are scheduled on this device. If a shared medicine exists, run the sync above and
            re-check; then read the Metro log line “[Meddy notifications] Shared sync result”.
          </Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
          <View>
            {meddyReminders.map((item) => (
              <View key={item.identifier} style={styles.row}>
                <Text style={styles.cellName}>{item.medicineName ?? '—'}</Text>
                <Text style={styles.cell}>{item.scope}</Text>
                <Text style={styles.cell}>{item.triggerSummary}</Text>
                <Text style={styles.cell}>{item.reminderSound ?? '—'}</Text>
                <Text style={styles.cell}>
                  {item.vibrationEnabled === null ? '—' : item.vibrationEnabled ? 'vibrate' : 'no vibrate'}
                </Text>
                <Text style={styles.cellId}>{item.channelId ?? '—'}</Text>
                <Text style={styles.cellId}>{item.identifier}</Text>
                <Text style={styles.cell}>{item.belongsToCurrentUser ? 'this user' : 'other user'}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      <Text style={styles.hint}>
        Columns: medicine · scope · trigger · sound · vibration · channel · identifier · owner. A shared reminder
        should read “care_circle · daily HH:MM · &lt;sound&gt; · vibrate · meddy-&lt;sound&gt;-v4 ·
        meddy-reminder-&lt;scheduleId&gt; · this user”. Reminders now use bundled WAV sounds on the normal
        notification stream, so raise the ringer/notification volume (and turn off Do Not Disturb) when testing.
      </Text>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 10 },
  status: { color: Palette.text, fontSize: 13, lineHeight: 19, marginTop: 14, fontWeight: '600' },
  summary: { marginTop: 14, gap: 4 },
  summaryLine: { color: Palette.text, fontSize: 13, lineHeight: 19 },
  body: { color: Palette.textSecondary, fontSize: 14, lineHeight: 21 },
  tableScroll: { marginTop: 14 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Palette.border },
  cell: { color: Palette.textSecondary, fontSize: 12, lineHeight: 17 },
  cellName: { color: Palette.text, fontSize: 12, lineHeight: 17, fontWeight: '700', minWidth: 90 },
  cellId: { color: Palette.textSecondary, fontSize: 12, lineHeight: 17, minWidth: 200 },
  hint: { color: Palette.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 16 },
});
