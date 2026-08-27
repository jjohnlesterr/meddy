import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

export const nativeNotificationsAvailable = Platform.OS !== 'web' && !isRunningInExpoGo();

let notificationsModulePromise: Promise<NotificationsModule> | null = null;

export async function getNotificationsModule() {
  if (!nativeNotificationsAvailable) return null;
  notificationsModulePromise ??= import('expo-notifications');
  return notificationsModulePromise;
}
