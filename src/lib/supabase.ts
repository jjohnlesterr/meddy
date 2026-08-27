import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

type SupabaseErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

type SupabaseResultLike = {
  error: SupabaseErrorLike | null;
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigurationError =
  !supabaseUrl || !supabaseAnonKey
    ? 'Supabase environment variables are missing. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart Expo.'
    : null;

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export class SupabaseSessionExpiredError extends Error {
  constructor() {
    super('Your session has expired. Please log in again.');
    this.name = 'SupabaseSessionExpiredError';
  }
}

let sessionRefreshPromise: Promise<boolean> | null = null;
let localSignOutPromise: Promise<void> | null = null;

function isInvalidJwtError(error: SupabaseErrorLike | null) {
  return error?.code === 'PGRST301' || error?.code === 'PGRST303';
}

function logAuthError(message: string, error: SupabaseErrorLike | null) {
  if (!__DEV__) return;
  console.error(`[Meddy auth] ${message}`, {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
  });
}

async function clearLocalSession() {
  if (!supabase) return;
  if (localSignOutPromise) return localSignOutPromise;

  localSignOutPromise = (async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error && __DEV__) console.error('[Meddy auth] Could not clear the invalid local session.', error);
    } catch (error) {
      if (__DEV__) console.error('[Meddy auth] Could not clear the invalid local session.', error);
    }
  })().finally(() => {
    localSignOutPromise = null;
  });

  return localSignOutPromise;
}

async function refreshCurrentSession() {
  if (!supabase) return false;
  if (sessionRefreshPromise) return sessionRefreshPromise;

  sessionRefreshPromise = (async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        logAuthError('The rejected JWT could not be refreshed.', error);
        return false;
      }

      if (__DEV__) console.info('[Meddy auth] Refreshed the Supabase session after a JWT rejection.');
      return true;
    } catch (error) {
      if (__DEV__) console.error('[Meddy auth] Session refresh failed.', error);
      return false;
    }
  })().finally(() => {
    sessionRefreshPromise = null;
  });

  return sessionRefreshPromise;
}

export async function executeSupabaseRequest<T extends SupabaseResultLike>(
  request: () => PromiseLike<T>,
): Promise<T> {
  const firstResult = await request();
  if (!isInvalidJwtError(firstResult.error)) return firstResult;

  logAuthError('Supabase rejected the current session JWT.', firstResult.error);
  if (!(await refreshCurrentSession())) {
    await clearLocalSession();
    throw new SupabaseSessionExpiredError();
  }

  const retryResult = await request();
  if (!isInvalidJwtError(retryResult.error)) return retryResult;

  logAuthError('Supabase rejected the refreshed session JWT.', retryResult.error);
  await clearLocalSession();
  throw new SupabaseSessionExpiredError();
}
