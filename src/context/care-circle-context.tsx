import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAppState } from '@/context/app-state';
import { syncSharedCareCircleNotifications } from '@/lib/care-circle-notifications';
import { recordActivity } from '@/lib/meddy-activity';
import { supabase } from '@/lib/supabase';
import {
  createCareCircle as createCareCircleRecord,
  deleteCareCircle as deleteCareCircleRecord,
  fetchCareCircles,
  fetchMyCareCircleRequests,
  joinCareCircle as joinCareCircleRecord,
  leaveCareCircle as leaveCareCircleRecord,
  updateCareCircleName,
} from '@/lib/care-circles';
import type { CareCircleSummary, JoinCareCircleResult, MyCareCircleRequest } from '@/types/care-circle';

type CareCircleContextValue = {
  circles: CareCircleSummary[];
  pendingRequests: MyCareCircleRequest[];
  isLoading: boolean;
  error: string | null;
  refreshCircles: (options?: { background?: boolean }) => Promise<void>;
  createCircle: (name: string) => Promise<CareCircleSummary>;
  joinCircle: (code: string) => Promise<JoinCareCircleResult>;
  deleteCircle: (circleId: string) => Promise<void>;
  leaveCircle: (circleId: string) => Promise<void>;
  updateCircle: (circleId: string, name: string) => Promise<void>;
};

const CareCircleContext = createContext<CareCircleContextValue | null>(null);

function messageFromError(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    const code = 'code' in error && typeof error.code === 'string' ? error.code : null;
    if (code) return __DEV__ ? `[${code}] ${error.message}` : 'We could not load your Care Circles. Please try again.';
    return error.message;
  }
  return 'We could not load your Care Circles.';
}

function logCareCircleError(error: unknown) {
  if (!__DEV__) return;
  if (error && typeof error === 'object') {
    console.error('[Meddy Care Circle] Supabase request failed.', {
      code: 'code' in error ? error.code : undefined,
      message: 'message' in error ? error.message : undefined,
      details: 'details' in error ? error.details : undefined,
      hint: 'hint' in error ? error.hint : undefined,
    });
    return;
  }
  console.error('[Meddy Care Circle] Request failed.', error);
}

export function CareCircleProvider({ children }: PropsWithChildren) {
  const { session } = useAppState();
  const userId = session?.user.id;
  const [circles, setCircles] = useState<CareCircleSummary[]>([]);
  const [pendingRequests, setPendingRequests] = useState<MyCareCircleRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  // Previous pending outgoing join requests, so a refresh can detect the moment
  // one is accepted (gone from pending + its circle now appears in membership).
  const previousPending = useRef<MyCareCircleRequest[]>([]);

  const refreshCircles = useCallback(async (options?: { background?: boolean }) => {
    const currentRequest = ++requestId.current;
    if (!userId) {
      setCircles([]);
      setPendingRequests([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    // A background refresh (focus poll, foreground return, realtime event) keeps
    // the current list on screen and never flips the full-screen loading state.
    if (!options?.background) setIsLoading(true);
    setError(null);
    try {
      const [nextCircles, nextRequests] = await Promise.all([
        fetchCareCircles(userId),
        fetchMyCareCircleRequests(userId),
      ]);
      if (currentRequest === requestId.current) {
        if (userId) {
          const stillPending = new Set(nextRequests.map((request) => request.id));
          const memberCircleIds = new Set(nextCircles.map((circle) => circle.id));
          for (const previous of previousPending.current) {
            if (!stillPending.has(previous.id) && memberCircleIds.has(previous.circleId)) {
              void recordActivity(userId, {
                id: `join-accepted:${previous.id}`,
                type: 'care_circle_request_accepted',
                title: 'Join request accepted',
                body: `You are now a member of ${previous.circleName}.`,
                createdAt: new Date().toISOString(),
                href: `/care/${previous.circleId}`,
              });
            }
          }
        }
        previousPending.current = nextRequests;
        setCircles(nextCircles);
        setPendingRequests(nextRequests);
        setError(null);
      }
    } catch (loadError) {
      logCareCircleError(loadError);
      if (currentRequest === requestId.current && !options?.background) {
        setCircles([]);
        setPendingRequests([]);
        setError(messageFromError(loadError));
      }
    } finally {
      if (currentRequest === requestId.current && !options?.background) setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const refreshTimer = setTimeout(() => {
      void refreshCircles();
    }, 0);

    return () => clearTimeout(refreshTimer);
  }, [refreshCircles]);

  // Keep membership / join-request state in sync without a re-login. When the
  // app returns to the foreground we refetch; when Supabase Realtime is enabled
  // for these tables, membership and join-request changes for this user trigger
  // an immediate refetch. If Realtime is not enabled the subscription simply
  // stays idle and the focus poll in the Care Circle screen covers sync.
  useEffect(() => {
    if (!userId) return;

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshCircles({ background: true });
    });

    const client = supabase;
    const channel = client
      ? client
          .channel(`care-circle-sync-${userId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'care_circle_members', filter: `user_id=eq.${userId}` },
            () => {
              void refreshCircles({ background: true });
              // Membership just changed: pick up or drop shared-medicine reminders.
              void syncSharedCareCircleNotifications(userId);
            },
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'care_circle_join_requests', filter: `user_id=eq.${userId}` },
            () => void refreshCircles({ background: true }),
          )
          .subscribe((status) => {
            if (__DEV__ && status === 'CHANNEL_ERROR') {
              console.warn('[Meddy Care Circle] Realtime unavailable; using focus refresh and polling instead.');
            }
          })
      : null;

    return () => {
      appStateSubscription.remove();
      if (client && channel) void client.removeChannel(channel);
    };
  }, [refreshCircles, userId]);

  const createCircle = useCallback(async (name: string) => {
    if (!userId) throw new Error('Your session has expired. Please log in again.');
    const created = await createCareCircleRecord(userId, name);
    setCircles((current) => [created, ...current.filter((circle) => circle.id !== created.id)]);
    setError(null);
    void recordActivity(userId, {
      id: `cc-created:${created.id}`,
      type: 'care_circle_created',
      title: 'Care Circle created',
      body: `You created ${created.name}.`,
      createdAt: new Date().toISOString(),
      href: `/care/${created.id}`,
    });
    return created;
  }, [userId]);

  const joinCircle = useCallback(async (code: string) => {
    if (!userId) throw new Error('Your session has expired. Please log in again.');
    const result = await joinCareCircleRecord(code);
    await refreshCircles();
    // If the code auto-joined an existing member, shared reminders may now apply.
    void syncSharedCareCircleNotifications(userId);
    const joined = result.status === 'accepted' || result.status === 'member';
    void recordActivity(userId, {
      id: joined ? `cc-joined:${result.circleId}` : `cc-requested:${result.circleId}`,
      type: joined ? 'care_circle_joined' : 'care_circle_join_requested',
      title: joined ? 'Joined Care Circle' : 'Join request sent',
      body: joined
        ? `You joined ${result.circleName}.`
        : `Your request to join ${result.circleName} is waiting for approval.`,
      createdAt: new Date().toISOString(),
      href: joined ? `/care/${result.circleId}` : '/care-circle',
    });
    return result;
  }, [refreshCircles, userId]);

  const deleteCircle = useCallback(async (circleId: string) => {
    if (!userId) throw new Error('Your session has expired. Please log in again.');
    await deleteCareCircleRecord(circleId, userId);
    setCircles((current) => current.filter((circle) => circle.id !== circleId));
    // Drop local reminders for that circle's shared medicines on this device.
    void syncSharedCareCircleNotifications(userId);
  }, [userId]);

  const leaveCircle = useCallback(async (circleId: string) => {
    if (!userId) throw new Error('Your session has expired. Please log in again.');
    const left = circles.find((circle) => circle.id === circleId);
    await leaveCareCircleRecord(circleId, userId);
    setCircles((current) => current.filter((circle) => circle.id !== circleId));
    // Drop local reminders for that circle's shared medicines on this device.
    void syncSharedCareCircleNotifications(userId);
    void recordActivity(userId, {
      id: `cc-left:${circleId}:${new Date().toISOString().slice(0, 16)}`,
      type: 'care_circle_left',
      title: 'Left Care Circle',
      body: left ? `You left ${left.name}.` : 'You left a Care Circle.',
      createdAt: new Date().toISOString(),
    });
  }, [circles, userId]);

  const updateCircle = useCallback(async (circleId: string, name: string) => {
    if (!userId) throw new Error('Your session has expired. Please log in again.');
    await updateCareCircleName(circleId, name);
    setCircles((current) => current.map((circle) => circle.id === circleId ? { ...circle, name: name.trim() } : circle));
  }, [userId]);

  const value = useMemo<CareCircleContextValue>(() => ({
    circles,
    pendingRequests,
    isLoading,
    error,
    refreshCircles,
    createCircle,
    joinCircle,
    deleteCircle,
    leaveCircle,
    updateCircle,
  }), [circles, createCircle, deleteCircle, error, isLoading, joinCircle, leaveCircle, pendingRequests, refreshCircles, updateCircle]);

  return <CareCircleContext.Provider value={value}>{children}</CareCircleContext.Provider>;
}

export function useCareCircles() {
  const context = useContext(CareCircleContext);
  if (!context) throw new Error('useCareCircles must be used inside CareCircleProvider');
  return context;
}
