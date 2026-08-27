import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import type { NotificationResponse, Subscription } from 'expo-notifications';
import { useEffect, useRef } from 'react';

import { useAppState } from '@/context/app-state';
import {
  parseMedicineNotificationData,
  SNOOZE_ACTION_IDENTIFIER,
  snoozeMedicineNotification,
} from '@/lib/medicine-notifications';
import { occurrenceId, recordActivity } from '@/lib/meddy-activity';
import { getNotificationsModule } from '@/lib/notification-runtime';

type ReminderData = NonNullable<ReturnType<typeof parseMedicineNotificationData>>;

function logReminderActivity(data: ReminderData) {
  const nowIso = new Date().toISOString();
  void recordActivity(data.userId, {
    id: occurrenceId(`rx:${data.scheduleId}`, nowIso),
    type: 'medicine_reminder',
    title: data.title,
    body: data.careCircleId ? `${data.body} (Care Circle reminder)` : data.body,
    createdAt: nowIso,
    href: data.url,
  });
}

function logSnoozeActivity(data: ReminderData) {
  const nowIso = new Date().toISOString();
  void recordActivity(data.userId, {
    id: occurrenceId(`rx-snooze:${data.scheduleId}`, nowIso),
    type: 'medicine_snoozed',
    title: `Snoozed ${data.title.replace(/^Time for /, '')}`,
    body: `Reminder will repeat in ${data.snoozeMinutes} minutes.`,
    createdAt: nowIso,
    href: data.url,
  });
}

export function NotificationResponseObserver() {
  const router = useRouter();
  const { isInitializing, profile, session } = useAppState();
  const handledResponses = useRef(new Set<string>());
  const canOpenMedicine = !isInitializing && Boolean(session && profile?.onboarding_completed);

  useEffect(() => {
    let active = true;
    let subscription: Subscription | null = null;
    let receivedSubscription: Subscription | null = null;

    async function startObserver() {
      const Notifications = await getNotificationsModule();
      if (!Notifications || !active) return;
      const notificationModule = Notifications;

      async function handleResponse(response: NotificationResponse) {
        const responseKey = `${response.notification.request.identifier}:${response.actionIdentifier}`;
        if (handledResponses.current.has(responseKey)) return;

        const data = parseMedicineNotificationData(response.notification.request.content.data);
        if (!data) return;

        if (response.actionIdentifier === SNOOZE_ACTION_IDENTIFIER) {
          handledResponses.current.add(responseKey);
          const snoozed = await snoozeMedicineNotification(data);
          if (snoozed) logSnoozeActivity(data);
          notificationModule.clearLastNotificationResponse();
          return;
        }

        if (response.actionIdentifier !== notificationModule.DEFAULT_ACTION_IDENTIFIER || !canOpenMedicine) return;

        handledResponses.current.add(responseKey);
        logReminderActivity(data);
        notificationModule.clearLastNotificationResponse();
        if (session?.user.id === data.userId && data.url.startsWith('/medicine/')) {
          router.push(data.url as Href);
        }
      }

      const lastResponse = notificationModule.getLastNotificationResponse();
      if (lastResponse) {
        void handleResponse(lastResponse).catch((error) => {
          if (__DEV__) console.error('[Meddy notifications] Could not handle notification response.', error);
        });
      }

      subscription = notificationModule.addNotificationResponseReceivedListener((response) => {
        void handleResponse(response).catch((error) => {
          if (__DEV__) console.error('[Meddy notifications] Could not handle notification response.', error);
        });
      });

      // A reminder that fires while the app is foregrounded produces no response
      // event unless the user taps it. Record it in the activity feed here so it
      // still shows up on the Notifications screen.
      receivedSubscription = notificationModule.addNotificationReceivedListener((notification) => {
        const data = parseMedicineNotificationData(notification.request.content.data);
        if (data) logReminderActivity(data);
      });
    }

    void startObserver().catch((error) => {
      if (__DEV__) console.error('[Meddy notifications] Could not start notification response observer.', error);
    });

    return () => {
      active = false;
      subscription?.remove();
      receivedSubscription?.remove();
    };
  }, [canOpenMedicine, router, session?.user.id]);

  return null;
}
