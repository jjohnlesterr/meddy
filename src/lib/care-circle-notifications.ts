import { reconcileMedicineNotifications } from '@/lib/medicine-notifications';
import { fetchMedicines } from '@/lib/medicines';
import { nativeNotificationsAvailable } from '@/lib/notification-runtime';

/**
 * Re-syncs this device's local medicine reminders against the current Supabase
 * truth, including Care Circle shared medicines.
 *
 * `fetchMedicines` returns the caller's personal medicines plus every shared
 * medicine in a Care Circle they are an accepted member of (enforced by RLS on
 * `medicines`). Every returned active schedule is therefore one this device
 * should hold a local reminder for. `reconcileMedicineNotifications` then:
 *   - schedules any missing reminder using the shared medicine's own time and
 *     reminder settings (sound / vibration / snooze),
 *   - reschedules a reminder whose time or settings changed,
 *   - cancels a reminder whose medicine or schedule is gone or disabled — e.g.
 *     after the shared medicine is deleted, or after this user leaves / is
 *     removed from the circle and can no longer see it.
 *
 * It never creates a second local notification for the same schedule: reminders
 * are keyed by schedule id, so repeated syncs are idempotent.
 *
 * Safe to call from anywhere. On web and in Expo Go the native notifications
 * module is unavailable, so this is a guaranteed no-op (shared medicine data
 * itself keeps working); it also swallows transient fetch errors so a network
 * blip never wipes already-scheduled reminders.
 */
export async function syncSharedCareCircleNotifications(userId: string): Promise<void> {
  if (!userId || !nativeNotificationsAvailable) return;

  try {
    const medicines = await fetchMedicines(userId);
    await reconcileMedicineNotifications(userId, medicines);
  } catch (error) {
    if (__DEV__) {
      console.warn('[Meddy notifications] Shared Care Circle reminder sync failed.', error);
    }
  }
}
