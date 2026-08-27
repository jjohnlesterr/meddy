import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NotificationContentInput, NotificationPermissionsStatus } from 'expo-notifications';
import { Platform } from 'react-native';

import { getNotificationsModule } from '@/lib/notification-runtime';
import type { Medicine, MedicineSchedule, ReminderSound } from '@/types/medicine';

const STORAGE_PREFIX = '@meddy/medicine-notifications';
const REMINDER_CATEGORY = 'MEDDY_MEDICINE_REMINDER';
export const SNOOZE_ACTION_IDENTIFIER = 'MEDDY_SNOOZE';
const VIBRATION_PATTERN = [0, 250, 150, 250];

// The three custom reminder sounds now ship with the app:
//   - assets/sounds/{gentle_chime,soft_bell,morning_tone}.wav exist in the repo,
//   - they are listed in the expo-notifications config plugin `sounds` array in
//     app.json (which copies them to android/app/src/main/res/raw as raw
//     resources named gentle_chime / soft_bell / morning_tone), and
//   - they are require()'d for the in-app preview (reminder-sound-previews.ts).
// They are always available in a real dev/production build; the env var only
// lets a developer force the OS-default fallback for debugging.
const CUSTOM_SOUNDS_ENABLED = process.env.EXPO_PUBLIC_MEDDY_CUSTOM_NOTIFICATION_SOUNDS !== 'false';

const SOUND_DETAILS: Record<ReminderSound, { label: string; file: string }> = {
  gentle_chime: { label: 'Gentle Chime', file: 'gentle_chime.wav' },
  soft_bell: { label: 'Soft Bell', file: 'soft_bell.wav' },
  morning_tone: { label: 'Morning Tone', file: 'morning_tone.wav' },
};

type StoredNotification = {
  medicineId: string;
  scheduleId: string;
  fingerprint: string;
  recurringIdentifier?: string;
  snoozeIdentifier?: string;
};

type StoredNotifications = Record<string, StoredNotification>;

export type MedicineNotificationData = {
  kind: 'medicine_reminder';
  userId: string;
  medicineId: string;
  scheduleId: string;
  careCircleId: string | null;
  url: string;
  title: string;
  body: string;
  fingerprint: string;
  reminderSound: ReminderSound;
  vibrationEnabled: boolean;
  snoozeEnabled: boolean;
  snoozeMinutes: number;
};

type DesiredReminder = {
  medicine: Medicine;
  schedule: MedicineSchedule;
  fingerprint: string;
};

let infrastructurePromise: Promise<void> | null = null;
let notificationQueue: Promise<void> = Promise.resolve();
let notificationHandlerConfigured = false;

type NotificationsModule = NonNullable<Awaited<ReturnType<typeof getNotificationsModule>>>;

async function getConfiguredNotifications() {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return null;

  if (!notificationHandlerConfigured) {
    notificationHandlerConfigured = true;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      }),
    });
  }

  return Notifications;
}

function enqueueNotificationWork<T>(work: () => Promise<T>): Promise<T> {
  const result = notificationQueue.then(work, work);
  notificationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}/${userId}`;
}

function recurringIdentifier(scheduleId: string) {
  return `meddy-reminder-${scheduleId}`;
}

function snoozeIdentifier(scheduleId: string) {
  return `meddy-snooze-${scheduleId}`;
}

// Returns the bundled custom sound filename for a reminder sound (e.g.
// "gentle_chime.wav"), or undefined to mean "use the OS default notification
// sound" (only when a developer sets EXPO_PUBLIC_MEDDY_CUSTOM_NOTIFICATION_SOUNDS
// =false to debug the fallback path).
//
// Never pass the string 'default' as a channel sound: expo-notifications treats
// any channel sound string as a bundled raw-resource filename and logs
// "Custom sound 'default' not found in native app" when it is missing. Omitting
// the `sound` key entirely is what selects the system default sound.
function customSoundFile(sound: ReminderSound): string | undefined {
  return CUSTOM_SOUNDS_ENABLED ? SOUND_DETAILS[sound].file : undefined;
}

// Bump this suffix whenever channel importance / sound / vibration / audio-usage
// config changes: Android keeps the settings of an already-created channel
// forever, so the only way to apply new config is a brand new channel id.
//
// v3: audio usage switched from ALARM to NOTIFICATION so the default reminder
//     sound plays on the stream users actually keep audible.
// v4: real bundled WAV sounds (gentle_chime / soft_bell / morning_tone) replace
//     the omitted-sound "system default" channels — a channel created under v3
//     has no custom sound and Android will not let us add one in place.
const CHANNEL_VERSION = 'v4';

// Legacy channel ids created by earlier builds. They are deleted on startup so
// a device that made a silent / vibration-only / alarm-stream / system-default
// channel does not keep using it after this build changes the channel config.
const LEGACY_CHANNEL_IDS = (Object.keys(SOUND_DETAILS) as ReminderSound[]).flatMap((sound) => {
  const base = `meddy-${sound.replace('_', '-')}`;
  return [
    `${base}-vibrate-default-v1`,
    `${base}-quiet-default-v1`,
    `${base}-vibrate-custom-v1`,
    `${base}-quiet-custom-v1`,
    `${base}-v2`,
    `${base}-novib-v2`,
    `${base}-v3`,
    `${base}-novib-v3`,
  ];
});

function channelIdentifier(sound: ReminderSound, vibrationEnabled: boolean) {
  const base = `meddy-${sound.replace('_', '-')}`;
  return vibrationEnabled ? `${base}-${CHANNEL_VERSION}` : `${base}-novib-${CHANNEL_VERSION}`;
}

async function configureNotificationInfrastructure(Notifications: NotificationsModule) {
  if (infrastructurePromise) return infrastructurePromise;

  infrastructurePromise = (async () => {
    if (Platform.OS === 'android') {
      // Remove stale channels from earlier builds so their cached (possibly
      // silent / vibration-only) settings are not reused.
      await Promise.all(
        LEGACY_CHANNEL_IDS.map((channelId) =>
          Notifications.deleteNotificationChannelAsync(channelId).catch(() => undefined),
        ),
      );

      const soundsBundled = customSoundFile('gentle_chime') !== undefined;
      if (__DEV__) {
        console.log(
          soundsBundled
            ? `[Meddy notifications] Custom reminder sounds ACTIVE — channels ${CHANNEL_VERSION}: ` +
              (Object.keys(SOUND_DETAILS) as ReminderSound[])
                .map((sound) => `${sound}->${SOUND_DETAILS[sound].file}`)
                .join(', ') +
              '. On Android these resolve to res/raw/<name> (extension dropped).'
            : '[Meddy notifications] Fallback sound in use: EXPO_PUBLIC_MEDDY_CUSTOM_NOTIFICATION_SOUNDS=false, ' +
              'so every reminder channel uses the Android SYSTEM DEFAULT notification sound (not silent).',
        );
      }

      const channelTasks = (Object.keys(SOUND_DETAILS) as ReminderSound[]).flatMap((sound) =>
        [true, false].map((vibrationEnabled) => {
          const soundFile = customSoundFile(sound);
          return Notifications.setNotificationChannelAsync(channelIdentifier(sound, vibrationEnabled), {
            name: `Medicine reminders · ${SOUND_DETAILS[sound].label}${vibrationEnabled ? '' : ' · No vibration'}`,
            description: 'Daily Meddy medication reminders.',
            importance: Notifications.AndroidImportance.HIGH,
            // `sound` is the bundled raw-resource filename (e.g. "gentle_chime.wav");
            // expo-notifications drops the extension and looks up res/raw/<name>.
            // Omitting the key would fall back to the system default sound. Never
            // pass the string 'default' here.
            ...(soundFile ? { sound: soundFile } : {}),
            enableVibrate: vibrationEnabled,
            vibrationPattern: vibrationEnabled ? VIBRATION_PATTERN : null,
            enableLights: true,
            lightColor: '#DE7894',
            // NOTIFICATION (not ALARM): the sound plays on the normal
            // notification stream, which users keep audible, instead of the
            // separate alarm-volume stream that tested silent on real devices.
            audioAttributes: { usage: Notifications.AndroidAudioUsage.NOTIFICATION },
          });
        }),
      );
      await Promise.all(channelTasks);
    }

    await Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY, [
      {
        identifier: SNOOZE_ACTION_IDENTIFIER,
        buttonTitle: 'Snooze',
        options: { opensAppToForeground: true },
      },
    ]);
  })().catch((error) => {
    infrastructurePromise = null;
    throw error;
  });

  return infrastructurePromise;
}

function notificationPermissionGranted(status: NotificationPermissionsStatus, Notifications: NotificationsModule) {
  if (Platform.OS !== 'ios') return status.granted;
  const iosStatus = status.ios?.status;
  return (
    status.granted ||
    iosStatus === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

async function ensureNotificationPermission(Notifications: NotificationsModule) {
  await configureNotificationInfrastructure(Notifications);

  const current = await Notifications.getPermissionsAsync();
  if (notificationPermissionGranted(current, Notifications)) return true;

  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return notificationPermissionGranted(requested, Notifications);
}

async function readStoredNotifications(userId: string): Promise<StoredNotifications> {
  const stored = await AsyncStorage.getItem(storageKey(userId));
  if (!stored) return {};

  try {
    return JSON.parse(stored) as StoredNotifications;
  } catch (error) {
    if (__DEV__) console.warn('[Meddy notifications] Ignoring invalid local notification metadata.', error);
    return {};
  }
}

async function writeStoredNotifications(userId: string, stored: StoredNotifications) {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(stored));
}

function medicineDosage(medicine: Medicine) {
  return [medicine.dosage_value, medicine.dosage_unit].filter(Boolean).join(' ');
}

function notificationCopy(medicine: Medicine) {
  const dosage = medicineDosage(medicine);
  const details = [dosage ? `Dosage: ${dosage}.` : null, medicine.instructions?.trim() || null].filter(Boolean);
  return {
    title: `Time for ${medicine.name}`,
    body: details.join(' ') || 'It is time for your scheduled medicine.',
  };
}

function reminderFingerprint(medicine: Medicine, schedule: MedicineSchedule) {
  return JSON.stringify({
    medicineId: medicine.id,
    name: medicine.name,
    dosageValue: medicine.dosage_value,
    dosageUnit: medicine.dosage_unit,
    instructions: medicine.instructions,
    medicineActive: medicine.active,
    scheduleId: schedule.id,
    timeOfDay: schedule.time_of_day,
    frequencyType: schedule.frequency_type,
    daysOfWeek: schedule.days_of_week,
    startDate: schedule.start_date,
    endDate: schedule.end_date,
    scheduleActive: schedule.active,
    reminderSound: schedule.reminder_sound,
    vibrationEnabled: schedule.vibration_enabled,
    snoozeEnabled: schedule.snooze_enabled,
    snoozeMinutes: schedule.snooze_minutes,
  });
}

function notificationData(
  userId: string,
  medicine: Medicine,
  schedule: MedicineSchedule,
  fingerprint: string,
): MedicineNotificationData {
  const copy = notificationCopy(medicine);
  return {
    kind: 'medicine_reminder',
    userId,
    medicineId: medicine.id,
    scheduleId: schedule.id,
    careCircleId: medicine.care_circle_id,
    url: `/medicine/${medicine.id}`,
    title: copy.title,
    body: copy.body,
    fingerprint,
    reminderSound: schedule.reminder_sound,
    vibrationEnabled: schedule.vibration_enabled,
    snoozeEnabled: schedule.snooze_enabled,
    snoozeMinutes: schedule.snooze_minutes,
  };
}

function notificationContent(data: MedicineNotificationData, Notifications: NotificationsModule): NotificationContentInput {
  return {
    title: data.title,
    body: data.body,
    data: { ...data },
    // A bundled custom filename, or `true` for the OS default sound. On Android
    // 8+ the channel's sound wins anyway; this matters mainly for iOS.
    sound: customSoundFile(data.reminderSound) ?? true,
    vibrate: data.vibrationEnabled ? VIBRATION_PATTERN : [],
    priority: Notifications.AndroidNotificationPriority.HIGH,
    categoryIdentifier: data.snoozeEnabled ? REMINDER_CATEGORY : undefined,
    color: '#DE7894',
  };
}

function scheduleTime(timeOfDay: string) {
  const [rawHour, rawMinute] = timeOfDay.split(':').map(Number);
  return {
    hour: Number.isInteger(rawHour) && rawHour >= 0 && rawHour <= 23 ? rawHour : 8,
    minute: Number.isInteger(rawMinute) && rawMinute >= 0 && rawMinute <= 59 ? rawMinute : 0,
  };
}

// Mirrors expo-notifications' native DailyTrigger.nextTriggerDate(): today at
// hour:minute:00 device-local, or tomorrow if that moment already passed.
function nextDailyOccurrence(hour: number, minute: number) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

function deviceTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'unknown';
  }
}

async function scheduleDailyReminder(
  Notifications: NotificationsModule,
  userId: string,
  desired: DesiredReminder,
): Promise<string | null> {
  const { medicine, schedule, fingerprint } = desired;
  const data = notificationData(userId, medicine, schedule, fingerprint);
  const { hour, minute } = scheduleTime(schedule.time_of_day);
  const identifier = recurringIdentifier(schedule.id);
  const channelId = channelIdentifier(schedule.reminder_sound, schedule.vibration_enabled);

  await Notifications.cancelScheduledNotificationAsync(identifier);
  try {
    const scheduledId = await Notifications.scheduleNotificationAsync({
      identifier,
      content: notificationContent(data, Notifications),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId,
      },
    });
    if (__DEV__) {
      const now = new Date();
      const triggerAt = nextDailyOccurrence(hour, minute);
      const passedToday = triggerAt.getDate() !== now.getDate() || triggerAt.getMonth() !== now.getMonth();
      const offsetMin = -now.getTimezoneOffset();
      const offset = `${offsetMin >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(offsetMin) / 60)).padStart(2, '0')}:${String(Math.abs(offsetMin) % 60).padStart(2, '0')}`;
      console.log(
        '[Meddy reminder]\n' +
          `medicine: ${medicine.name} (${medicine.care_circle_id ? 'Care Circle' : 'personal'})\n` +
          `stored time: ${schedule.time_of_day} -> ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} (24h, seconds forced to 00)\n` +
          `current device time: ${now.toString()}\n` +
          `computed trigger: ${triggerAt.toString()} (daily, repeats)\n` +
          `timezone: ${deviceTimezone()} (UTC${offset})\n` +
          `scheduled notification id: ${scheduledId}\n` +
          `channel: ${channelId} | sound: ${customSoundFile(schedule.reminder_sound) ?? 'android system default'} | vibration: ${schedule.vibration_enabled}` +
          (passedToday
            ? `\nnote: ${schedule.time_of_day} has already passed today on this device — the daily trigger's first fire is TOMORROW at ${schedule.time_of_day}. This is not a one-minute shift; it is the normal next-occurrence behavior.`
            : ''),
      );
      console.log('[Meddy notifications] Scheduled reminder', {
        scope: medicine.care_circle_id ? 'care_circle' : 'personal',
        medicine: medicine.name,
        medicineId: medicine.id,
        careCircleId: medicine.care_circle_id,
        scheduleId: schedule.id,
        storedScheduleTime: schedule.time_of_day,
        parsedHourMinute: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
        currentDeviceTime: now.toString(),
        calculatedTriggerDateTime: triggerAt.toString(),
        minutesUntilTrigger: Math.round((triggerAt.getTime() - now.getTime()) / 60000),
        timezone: deviceTimezone(),
        utcOffsetMinutes: offsetMin,
        reminderSound: schedule.reminder_sound,
        soundMode: customSoundFile(schedule.reminder_sound) ? `bundled:${customSoundFile(schedule.reminder_sound)}` : 'android-system-default',
        vibrationEnabled: schedule.vibration_enabled,
        channelId,
        notificationId: scheduledId,
      });
    }
    return scheduledId;
  } catch (error) {
    if (__DEV__) {
      console.error('[Meddy notifications] scheduleNotificationAsync failed', {
        medicine: medicine.name,
        scheduleId: schedule.id,
        careCircleId: medicine.care_circle_id,
        hour,
        minute,
        channelId,
        error,
      });
    }
    return null;
  }
}

async function cancelStoredNotification(Notifications: NotificationsModule, entry: StoredNotification) {
  const identifiers = [entry.recurringIdentifier, entry.snoozeIdentifier].filter(
    (identifier): identifier is string => Boolean(identifier),
  );
  await Promise.all(identifiers.map((identifier) => Notifications.cancelScheduledNotificationAsync(identifier)));
}

function desiredReminders(medicines: Medicine[]) {
  const desired = new Map<string, DesiredReminder>();
  for (const medicine of medicines) {
    for (const schedule of medicine.schedules) {
      if (!medicine.active || !schedule.active) continue;
      desired.set(schedule.id, {
        medicine,
        schedule,
        fingerprint: reminderFingerprint(medicine, schedule),
      });
    }
  }
  return desired;
}

export async function reconcileMedicineNotifications(userId: string, medicines: Medicine[]) {
  const Notifications = await getConfiguredNotifications();
  if (!Notifications) return;

  return enqueueNotificationWork(async () => {
    await configureNotificationInfrastructure(Notifications);
    const desired = desiredReminders(medicines);
    const stored = await readStoredNotifications(userId);
    const scheduledRequests = await Notifications.getAllScheduledNotificationsAsync();
    const scheduledIdentifiers = new Set(scheduledRequests.map((request) => request.identifier));

    for (const [scheduleId, entry] of Object.entries(stored)) {
      const next = desired.get(scheduleId);
      const recurringIsScheduled = entry.recurringIdentifier
        ? scheduledIdentifiers.has(entry.recurringIdentifier)
        : false;

      if (!next || next.fingerprint !== entry.fingerprint || !recurringIsScheduled) {
        await cancelStoredNotification(Notifications, entry);
        delete stored[scheduleId];
        continue;
      }

      if (entry.snoozeIdentifier && !scheduledIdentifiers.has(entry.snoozeIdentifier)) {
        delete entry.snoozeIdentifier;
      }
    }

    for (const request of scheduledRequests) {
      const data = parseMedicineNotificationData(request.content.data);
      if (!data || data.userId !== userId) continue;
      const next = desired.get(data.scheduleId);
      const expectedIdentifiers = [
        recurringIdentifier(data.scheduleId),
        snoozeIdentifier(data.scheduleId),
      ];
      if (
        !next ||
        next.fingerprint !== data.fingerprint ||
        !expectedIdentifiers.includes(request.identifier)
      ) {
        await Notifications.cancelScheduledNotificationAsync(request.identifier);
      }
    }

    if (desired.size === 0) {
      await writeStoredNotifications(userId, stored);
      if (__DEV__) await logReminderSyncDiagnostics(Notifications, userId, desired);
      return;
    }

    if (!(await ensureNotificationPermission(Notifications))) {
      await writeStoredNotifications(userId, stored);
      if (__DEV__) {
        console.warn('[Meddy notifications] Notification permission was not granted.');
        await logReminderSyncDiagnostics(Notifications, userId, desired);
      }
      return;
    }

    for (const [scheduleId, next] of desired) {
      if (stored[scheduleId]?.recurringIdentifier) continue;
      const identifier = await scheduleDailyReminder(Notifications, userId, next);
      if (!identifier) continue;
      stored[scheduleId] = {
        medicineId: next.medicine.id,
        scheduleId,
        fingerprint: next.fingerprint,
        recurringIdentifier: identifier,
      };
    }

    await writeStoredNotifications(userId, stored);
    if (__DEV__) await logReminderSyncDiagnostics(Notifications, userId, desired);
  });
}

/**
 * Development-only. Prints, after a reminder sync, exactly which schedules were
 * expected on this device and whether each one now has a matching entry in the
 * OS scheduled-notification list. Used to tell apart "the Care Circle schedule
 * never synced" from "the notification system/channel is the problem".
 */
async function logReminderSyncDiagnostics(
  Notifications: NotificationsModule,
  userId: string,
  desired: Map<string, DesiredReminder>,
) {
  try {
    if (Platform.OS === 'android') {
      const channels = await Notifications.getNotificationChannelsAsync();
      console.log(
        '[Meddy notifications] Android channels',
        channels.map((channel) => ({
          id: channel.id,
          importance: channel.importance,
          sound: channel.sound,
          vibration: channel.vibrationPattern ?? channel.enableVibrate,
        })),
      );
    }

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const mine = scheduled.filter((request) => {
      const data = parseMedicineNotificationData(request.content.data);
      return data?.userId === userId;
    });
    const scheduledIds = new Set(mine.map((request) => request.identifier));

    const details = [...desired.values()].map((entry) => ({
      scope: entry.medicine.care_circle_id ? ('care_circle' as const) : ('personal' as const),
      medicine: entry.medicine.name,
      careCircleId: entry.medicine.care_circle_id,
      scheduleId: entry.schedule.id,
      time: entry.schedule.time_of_day,
      reminderSound: entry.schedule.reminder_sound,
      qualifies: Boolean(entry.medicine.active && entry.schedule.active),
      expectedIdentifier: recurringIdentifier(entry.schedule.id),
      isScheduledOnDevice: scheduledIds.has(recurringIdentifier(entry.schedule.id)),
    }));
    const sharedDetails = details.filter((item) => item.scope === 'care_circle');
    const careCircleIds = [...new Set(sharedDetails.map((item) => item.careCircleId))];

    console.log(
      '[Meddy notifications] Shared sync result' +
        `\nUser id: ${userId}` +
        `\nCare Circle ids: ${JSON.stringify(careCircleIds)}` +
        `\nExpected shared schedules: ${sharedDetails.length}` +
        `\nExpected total schedules (incl. personal): ${details.length}` +
        `\nScheduled notifications on device: ${mine.length}` +
        `\nIDs: ${JSON.stringify([...scheduledIds])}` +
        `\nMissing (expected but NOT scheduled): ${JSON.stringify(
          details.filter((item) => !item.isScheduledOnDevice).map((item) => item.expectedIdentifier),
        )}`,
    );
    console.log('[Meddy notifications] Shared sync detail', details);
  } catch (error) {
    console.warn('[Meddy notifications] Could not print reminder sync diagnostics.', error);
  }
}

export async function cancelMedicineNotifications(userId: string, medicineId: string) {
  const Notifications = await getConfiguredNotifications();
  if (!Notifications) return;

  return enqueueNotificationWork(async () => {
    const stored = await readStoredNotifications(userId);
    const entries = Object.entries(stored).filter(([, entry]) => entry.medicineId === medicineId);
    await Promise.all(entries.map(([, entry]) => cancelStoredNotification(Notifications, entry)));
    for (const [scheduleId] of entries) delete stored[scheduleId];

    const scheduledRequests = await Notifications.getAllScheduledNotificationsAsync();
    const untracked = scheduledRequests.filter((request) => {
      const data = parseMedicineNotificationData(request.content.data);
      return data?.userId === userId && data.medicineId === medicineId;
    });
    await Promise.all(
      untracked.map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
    );
    await writeStoredNotifications(userId, stored);
  });
}

export function parseMedicineNotificationData(data: Record<string, unknown> | undefined) {
  if (
    data?.kind !== 'medicine_reminder' ||
    typeof data.userId !== 'string' ||
    typeof data.medicineId !== 'string' ||
    typeof data.scheduleId !== 'string' ||
    typeof data.url !== 'string' ||
    typeof data.title !== 'string' ||
    typeof data.body !== 'string' ||
    typeof data.fingerprint !== 'string' ||
    (data.reminderSound !== 'gentle_chime' &&
      data.reminderSound !== 'soft_bell' &&
      data.reminderSound !== 'morning_tone') ||
    typeof data.vibrationEnabled !== 'boolean' ||
    typeof data.snoozeEnabled !== 'boolean' ||
    typeof data.snoozeMinutes !== 'number'
  ) {
    return null;
  }

  // careCircleId is read leniently so reminders scheduled before this field
  // existed still parse (they are treated as personal).
  return {
    ...(data as MedicineNotificationData),
    careCircleId: typeof data.careCircleId === 'string' ? data.careCircleId : null,
  };
}

export async function snoozeMedicineNotification(data: MedicineNotificationData) {
  if (!data.snoozeEnabled) return false;
  const Notifications = await getConfiguredNotifications();
  if (!Notifications) return false;

  return enqueueNotificationWork(async () => {
    if (!(await ensureNotificationPermission(Notifications))) return false;

    const stored = await readStoredNotifications(data.userId);
    const previous = stored[data.scheduleId];
    if (previous?.snoozeIdentifier) {
      await Notifications.cancelScheduledNotificationAsync(previous.snoozeIdentifier);
    }

    const identifier = snoozeIdentifier(data.scheduleId);
    await Notifications.cancelScheduledNotificationAsync(identifier);
    const scheduledIdentifier = await Notifications.scheduleNotificationAsync({
      identifier,
      content: notificationContent(data, Notifications),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(60, Math.round(data.snoozeMinutes * 60)),
        repeats: false,
        channelId: channelIdentifier(data.reminderSound, data.vibrationEnabled),
      },
    });

    stored[data.scheduleId] = {
      medicineId: data.medicineId,
      scheduleId: data.scheduleId,
      fingerprint: data.fingerprint,
      recurringIdentifier: previous?.recurringIdentifier,
      snoozeIdentifier: scheduledIdentifier,
    };
    await writeStoredNotifications(data.userId, stored);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Development-only diagnostics. None of the exports below are used by product
// screens; they exist to debug why a scheduled reminder did or did not fire.
// ---------------------------------------------------------------------------

function testNotificationIdentifier(sound: ReminderSound) {
  return `meddy-test-30s-${sound.replace('_', '-')}`;
}

export type TestNotificationResult =
  | { scheduled: true; sound: ReminderSound; identifier: string; channelId: string; firesInSeconds: number }
  | { scheduled: false; sound: ReminderSound; reason: 'unavailable' | 'permission' | 'error'; error?: unknown };

/**
 * Development-only. Schedules ONE local notification 30 seconds from now for the
 * given reminder sound, using the exact same channel + handler as real medicine
 * reminders. Lets you confirm audible playback + vibration per sound choice and
 * separate a notification-system problem from a schedule-sync problem.
 */
export async function scheduleTestNotificationIn30Seconds(
  sound: ReminderSound = 'gentle_chime',
): Promise<TestNotificationResult> {
  const Notifications = await getConfiguredNotifications();
  if (!Notifications) {
    if (__DEV__) {
      console.warn('[Meddy notifications] Test notification skipped: native notifications unavailable (Expo Go or web).');
    }
    return { scheduled: false, sound, reason: 'unavailable' };
  }

  return enqueueNotificationWork(async () => {
    await configureNotificationInfrastructure(Notifications);

    if (!(await ensureNotificationPermission(Notifications))) {
      if (__DEV__) console.warn('[Meddy notifications] Test notification skipped: permission not granted.');
      return { scheduled: false, sound, reason: 'permission' } as TestNotificationResult;
    }

    const channelId = channelIdentifier(sound, true);
    const identifier = testNotificationIdentifier(sound);
    await Notifications.cancelScheduledNotificationAsync(identifier);

    try {
      const scheduledId = await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title: `Meddy test · ${SOUND_DETAILS[sound].label}`,
          body: 'If you hear this and/or feel it vibrate, the reminder channel works on this device.',
          sound: customSoundFile(sound) ?? true,
          vibrate: VIBRATION_PATTERN,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          color: '#DE7894',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 30,
          repeats: false,
          channelId,
        },
      });

      if (__DEV__) {
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        console.log('[Meddy notifications] Test notification scheduled', {
          sound,
          soundFile: customSoundFile(sound) ?? 'system default',
          identifier: scheduledId,
          channelId,
          firesInSeconds: 30,
          totalScheduledNow: scheduled.length,
          scheduledIds: scheduled.map((request) => request.identifier),
        });
      }
      return { scheduled: true, sound, identifier: scheduledId, channelId, firesInSeconds: 30 } as TestNotificationResult;
    } catch (error) {
      if (__DEV__) console.error('[Meddy notifications] Test notification scheduleNotificationAsync failed', error);
      return { scheduled: false, sound, reason: 'error', error } as TestNotificationResult;
    }
  });
}

export type ScheduledMeddyNotification = {
  identifier: string;
  scope: 'personal' | 'care_circle' | 'other';
  medicineName: string | null;
  medicineId: string | null;
  scheduleId: string | null;
  careCircleId: string | null;
  reminderSound: ReminderSound | null;
  vibrationEnabled: boolean | null;
  channelId: string | null;
  triggerSummary: string;
  belongsToCurrentUser: boolean;
};

function describeTrigger(trigger: unknown): string {
  if (!trigger || typeof trigger !== 'object') return 'unknown';
  const value = trigger as Record<string, unknown>;
  if (typeof value.hour === 'number' && typeof value.minute === 'number') {
    return `daily ${String(value.hour).padStart(2, '0')}:${String(value.minute).padStart(2, '0')}`;
  }
  if (typeof value.seconds === 'number') {
    return `in ${value.seconds}s${value.repeats ? ' (repeats)' : ''}`;
  }
  if (typeof value.value === 'number') return `at ${new Date(value.value).toISOString()}`;
  try {
    return JSON.stringify(trigger);
  } catch {
    return 'unknown';
  }
}

/**
 * Development-only. Returns every scheduled notification on the device with a
 * best-effort read of what medicine/schedule/trigger it belongs to, so a debug
 * screen can show whether a given shared reminder is actually queued.
 */
export async function inspectScheduledMeddyNotifications(
  currentUserId?: string,
): Promise<{ available: boolean; items: ScheduledMeddyNotification[] }> {
  const Notifications = await getConfiguredNotifications();
  if (!Notifications) return { available: false, items: [] };

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const items: ScheduledMeddyNotification[] = scheduled.map((request) => {
    const data = parseMedicineNotificationData(request.content.data);
    const rawCareCircleId =
      request.content.data && typeof request.content.data.careCircleId === 'string'
        ? (request.content.data.careCircleId as string)
        : data?.careCircleId ?? null;
    const trigger = (request.trigger ?? {}) as Record<string, unknown>;
    return {
      identifier: request.identifier,
      scope: data ? (rawCareCircleId ? 'care_circle' : 'personal') : 'other',
      medicineName: data
        ? data.title.replace(/^Time for /, '')
        : typeof request.content.title === 'string'
          ? request.content.title
          : null,
      medicineId: data?.medicineId ?? null,
      scheduleId: data?.scheduleId ?? null,
      careCircleId: rawCareCircleId,
      reminderSound: data?.reminderSound ?? null,
      vibrationEnabled:
        typeof data?.vibrationEnabled === 'boolean'
          ? data.vibrationEnabled
          : typeof trigger.channelId === 'string'
            ? !trigger.channelId.includes('-novib-')
            : null,
      channelId: typeof trigger.channelId === 'string' ? trigger.channelId : null,
      triggerSummary: describeTrigger(request.trigger),
      belongsToCurrentUser: Boolean(data) && (!currentUserId || data?.userId === currentUserId),
    };
  });

  if (__DEV__) {
    console.log('[Meddy notifications] Scheduled notifications on device', {
      total: items.length,
      identifiers: items.map((item) => item.identifier),
      items,
    });
  }
  return { available: true, items };
}
