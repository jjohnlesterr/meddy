import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';

import { useAppState } from '@/context/app-state';
import { useCareCircles } from '@/context/care-circle-context';
import { fetchIncomingJoinRequests, type IncomingJoinRequest } from '@/lib/care-circles';
import {
  markActivitySeen,
  readActivityStore,
  subscribeToActivity,
  type MeddyActivityItem,
  type MeddyActivityType,
} from '@/lib/meddy-activity';

export type MeddyFeedItem = MeddyActivityItem & {
  read: boolean;
  /** `local` = persisted device event, `derived` = live from Supabase, not stored. */
  origin: 'local' | 'derived';
};

type ActivityContextValue = {
  items: MeddyFeedItem[];
  unreadCount: number;
  refresh: () => Promise<void>;
  markAllSeen: () => Promise<void>;
};

const ActivityContext = createContext<ActivityContextValue | null>(null);

function isRead(createdAt: string, lastSeenAt: string | null, explicitlyRead: boolean) {
  if (explicitlyRead) return true;
  return lastSeenAt ? createdAt <= lastSeenAt : false;
}

export function MeddyActivityProvider({ children }: PropsWithChildren) {
  const { session } = useAppState();
  const userId = session?.user.id;
  const { circles, pendingRequests } = useCareCircles();

  const [events, setEvents] = useState<MeddyActivityItem[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<IncomingJoinRequest[]>([]);

  const loadLocal = useCallback(async () => {
    if (!userId) {
      setEvents([]);
      setReadIds([]);
      setLastSeenAt(null);
      return;
    }
    const store = await readActivityStore(userId);
    setEvents(store.events);
    setReadIds(store.readIds);
    setLastSeenAt(store.lastSeenAt);
  }, [userId]);

  const loadIncoming = useCallback(async () => {
    if (!userId) {
      setIncoming([]);
      return;
    }
    try {
      setIncoming(await fetchIncomingJoinRequests(userId));
    } catch (error) {
      // A read failure (e.g. RLS, offline) must never blank the feed.
      if (__DEV__) console.warn('[Meddy activity] Could not load incoming join requests.', error);
    }
  }, [userId]);

  // Reload the persisted log on mount, on user change, and on every local write.
  useEffect(() => {
    const timer = setTimeout(() => void loadLocal(), 0);
    const unsubscribe = subscribeToActivity(() => void loadLocal());
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [loadLocal]);

  // Refresh live-derived items when circles change or the app returns to foreground.
  useEffect(() => {
    const timer = setTimeout(() => void loadIncoming(), 0);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadIncoming();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [loadIncoming, circles.length]);

  const refresh = useCallback(async () => {
    await Promise.all([loadLocal(), loadIncoming()]);
  }, [loadLocal, loadIncoming]);

  const markAllSeen = useCallback(async () => {
    if (userId) await markActivitySeen(userId);
  }, [userId]);

  const items = useMemo<MeddyFeedItem[]>(() => {
    const local: MeddyFeedItem[] = events.map((event) => ({
      ...event,
      origin: 'local',
      read: isRead(event.createdAt, lastSeenAt, readIds.includes(event.id)),
    }));

    const derived: MeddyFeedItem[] = [];
    for (const request of pendingRequests) {
      derived.push({
        id: `join-out:${request.id}`,
        type: 'care_circle_join_requested' as MeddyActivityType,
        title: 'Join request pending',
        body: `Waiting for approval to join ${request.circleName}.`,
        createdAt: request.createdAt,
        href: '/care-circle',
        origin: 'derived',
        read: isRead(request.createdAt, lastSeenAt, false),
      });
    }
    for (const request of incoming) {
      derived.push({
        id: `join-in:${request.id}`,
        type: 'care_circle_request_incoming' as MeddyActivityType,
        title: 'New join request',
        body: `${request.requesterName} asked to join ${request.circleName}.`,
        createdAt: request.createdAt,
        href: `/care/${request.circleId}`,
        origin: 'derived',
        read: isRead(request.createdAt, lastSeenAt, false),
      });
    }

    return [...local, ...derived].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  }, [events, incoming, lastSeenAt, pendingRequests, readIds]);

  const unreadCount = useMemo(() => items.reduce((count, item) => (item.read ? count : count + 1), 0), [items]);

  const value = useMemo<ActivityContextValue>(
    () => ({ items, unreadCount, refresh, markAllSeen }),
    [items, markAllSeen, refresh, unreadCount],
  );

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}

export function useMeddyActivity() {
  const context = useContext(ActivityContext);
  if (!context) throw new Error('useMeddyActivity must be used inside MeddyActivityProvider');
  return context;
}
