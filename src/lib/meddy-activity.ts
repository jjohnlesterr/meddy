import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// Meddy in-app activity feed.
//
// There is no server-side notification-history table. This module keeps a small
// per-user log in AsyncStorage that is written from real in-app events as they
// happen (a reminder fires on this device, a medicine is snoozed, a Care Circle
// action succeeds, an outgoing join request is accepted). It is therefore:
//   - real, never fabricated — an entry only exists because that event occurred,
//   - local to this device — it does not sync between a user's devices,
//   - capped at MAX_EVENTS so it cannot grow without bound.
//
// The activity CONTEXT layers live, non-persisted items on top of this (pending
// join requests read straight from Supabase), but those are not stored here.
// ---------------------------------------------------------------------------

export type MeddyActivityType =
  | 'medicine_reminder'
  | 'medicine_snoozed'
  | 'shared_medicine_added'
  | 'shared_medicine_updated'
  | 'care_circle_created'
  | 'care_circle_join_requested'
  | 'care_circle_joined'
  | 'care_circle_left'
  | 'care_circle_request_accepted'
  | 'care_circle_request_incoming';

export type MeddyActivityItem = {
  id: string;
  type: MeddyActivityType;
  title: string;
  body?: string;
  /** ISO 8601 */
  createdAt: string;
  /** Optional in-app destination, e.g. `/medicine/<id>` or `/care/<id>`. */
  href?: string;
};

export type MeddyActivityStore = {
  events: MeddyActivityItem[];
  readIds: string[];
  lastSeenAt: string | null;
};

const STORAGE_PREFIX = '@meddy/activity';
const MAX_EVENTS = 100;
const EMPTY: MeddyActivityStore = { events: [], readIds: [], lastSeenAt: null };

type Listener = () => void;
const listeners = new Set<Listener>();

/** Subscribe to any local write (append / mark-seen / clear). Returns an unsubscribe. */
export function subscribeToActivity(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // A broken subscriber must not stop the others.
    }
  }
}

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}/${userId}`;
}

async function readStore(userId: string): Promise<MeddyActivityStore> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<MeddyActivityStore>;
    return {
      events: Array.isArray(parsed.events) ? (parsed.events as MeddyActivityItem[]) : [],
      readIds: Array.isArray(parsed.readIds) ? (parsed.readIds as string[]) : [],
      lastSeenAt: typeof parsed.lastSeenAt === 'string' ? parsed.lastSeenAt : null,
    };
  } catch (error) {
    if (__DEV__) console.warn('[Meddy activity] Ignoring invalid stored activity feed.', error);
    return { ...EMPTY };
  }
}

async function writeStore(userId: string, store: MeddyActivityStore) {
  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(store));
  } catch (error) {
    if (__DEV__) console.warn('[Meddy activity] Could not persist activity feed.', error);
  }
  emit();
}

/** Append one activity item. Ignored if an item with the same id already exists. */
export async function recordActivity(userId: string | null | undefined, item: MeddyActivityItem) {
  if (!userId || !item?.id || !item.type) return;
  const store = await readStore(userId);
  if (store.events.some((event) => event.id === item.id)) return;
  store.events = [item, ...store.events].slice(0, MAX_EVENTS);
  await writeStore(userId, store);
}

export async function readActivityStore(userId: string): Promise<MeddyActivityStore> {
  return readStore(userId);
}

/** Mark everything currently stored as seen and stamp the "last opened" time. */
export async function markActivitySeen(userId: string) {
  if (!userId) return;
  const store = await readStore(userId);
  store.lastSeenAt = new Date().toISOString();
  store.readIds = Array.from(new Set([...store.readIds, ...store.events.map((event) => event.id)]));
  await writeStore(userId, store);
}

export async function clearActivity(userId: string) {
  if (!userId) return;
  await writeStore(userId, { ...EMPTY });
}

/** Stable per-occurrence id: the same event on the same minute de-duplicates. */
export function occurrenceId(prefix: string, isoTimestamp: string) {
  return `${prefix}:${isoTimestamp.slice(0, 16)}`;
}
