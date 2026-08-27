import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAppState } from '@/context/app-state';
import { supabase } from '@/lib/supabase';
import {
  createMedicine as createMedicineRecord,
  deleteMedicine as deleteMedicineRecord,
  fetchMedicines,
  sortMedicinesByNextSchedule,
  updateMedicine as updateMedicineRecord,
} from '@/lib/medicines';
import {
  cancelMedicineNotifications,
  reconcileMedicineNotifications,
} from '@/lib/medicine-notifications';
import { recordActivity } from '@/lib/meddy-activity';
import type { Medicine, MedicineInput } from '@/types/medicine';

type MedicineContextValue = {
  allMedicines: Medicine[];
  medicines: Medicine[];
  isLoading: boolean;
  error: string | null;
  refreshMedicines: (options?: { background?: boolean }) => Promise<void>;
  createMedicine: (input: MedicineInput, careCircleId?: string | null) => Promise<Medicine>;
  updateMedicine: (medicineId: string, input: MedicineInput) => Promise<Medicine>;
  deleteMedicine: (medicineId: string) => Promise<void>;
};

const MedicineContext = createContext<MedicineContextValue | null>(null);

function messageFromError(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    const code = 'code' in error && typeof error.code === 'string' ? error.code : null;
    if (code) return __DEV__ ? `[${code}] ${error.message}` : 'We could not load your medicines. Please try again.';
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

function logMedicineError(error: unknown) {
  if (!__DEV__) return;

  if (error && typeof error === 'object') {
    console.error('[Meddy medicines] Supabase request failed.', {
      code: 'code' in error ? error.code : undefined,
      message: 'message' in error ? error.message : undefined,
      details: 'details' in error ? error.details : undefined,
      hint: 'hint' in error ? error.hint : undefined,
    });
    return;
  }

  console.error('[Meddy medicines] Request failed.', error);
}

async function reconcileNotifications(userId: string, medicines: Medicine[]) {
  try {
    await reconcileMedicineNotifications(userId, medicines);
  } catch (error) {
    if (__DEV__) console.error('[Meddy notifications] Could not synchronize reminders.', error);
  }
}

async function cancelNotifications(userId: string, medicineId: string) {
  try {
    await cancelMedicineNotifications(userId, medicineId);
  } catch (error) {
    if (__DEV__) console.error('[Meddy notifications] Could not cancel reminders.', error);
  }
}

export function MedicineProvider({ children }: PropsWithChildren) {
  const { session } = useAppState();
  const userId = session?.user.id;
  const [allMedicines, setAllMedicines] = useState<Medicine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refreshMedicines = useCallback(async (options?: { background?: boolean }) => {
    const currentRequest = ++requestId.current;
    if (!userId) {
      setAllMedicines([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    // A background refresh (foreground return, realtime event, Care Circle focus)
    // keeps the current list on screen and never flips the loading state.
    if (!options?.background) setIsLoading(true);
    setError(null);
    try {
      const nextMedicines = await fetchMedicines(userId);
      if (currentRequest === requestId.current) {
        const sortedMedicines = sortMedicinesByNextSchedule(nextMedicines);
        setAllMedicines(sortedMedicines);
        // Reconcile local reminders for every visible medicine — personal AND
        // Care Circle shared ones. `fetchMedicines` is already RLS-scoped to
        // circles this user belongs to, so each device schedules its own alarm.
        void reconcileNotifications(userId, sortedMedicines);
      }
    } catch (fetchError) {
      logMedicineError(fetchError);
      if (currentRequest === requestId.current && !options?.background) {
        setAllMedicines([]);
        setError(messageFromError(fetchError));
      }
    } finally {
      if (currentRequest === requestId.current && !options?.background) setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const refreshTimer = setTimeout(() => {
      void refreshMedicines();
    }, 0);

    return () => clearTimeout(refreshTimer);
  }, [refreshMedicines]);

  // Resync shared (and personal) reminders without a re-login: when the app
  // returns to the foreground, and — when Supabase Realtime is enabled for these
  // tables — whenever a medicine, schedule, or this user's Care Circle
  // membership changes. If Realtime is not enabled the subscription stays idle
  // and the foreground / Care Circle focus resyncs keep devices in step.
  useEffect(() => {
    if (!userId) return;

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshMedicines({ background: true });
    });

    const client = supabase;
    const channel = client
      ? client
          .channel(`medicine-sync-${userId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'medicines' },
            () => void refreshMedicines({ background: true }),
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'medicine_schedules' },
            () => void refreshMedicines({ background: true }),
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'care_circle_members', filter: `user_id=eq.${userId}` },
            () => void refreshMedicines({ background: true }),
          )
          .subscribe((status) => {
            if (__DEV__ && status === 'CHANNEL_ERROR') {
              console.warn('[Meddy medicines] Realtime unavailable; using foreground and focus resync instead.');
            }
          })
      : null;

    return () => {
      appStateSubscription.remove();
      if (client && channel) void client.removeChannel(channel);
    };
  }, [refreshMedicines, userId]);

  const createMedicine = useCallback(async (input: MedicineInput, careCircleId: string | null = null) => {
    if (!userId) throw new Error('Your session has expired. Please log in again.');
    const created = await createMedicineRecord(userId, input, careCircleId);
    const nextMedicines = sortMedicinesByNextSchedule([...allMedicines, created]);
    setAllMedicines(nextMedicines);
    setError(null);
    await reconcileNotifications(userId, nextMedicines);
    if (created.care_circle_id) {
      void recordActivity(userId, {
        id: `med-add:${created.id}`,
        type: 'shared_medicine_added',
        title: 'Shared medicine added',
        body: `${created.name} was added to a Care Circle.`,
        createdAt: new Date().toISOString(),
        href: `/medicine/${created.id}`,
      });
    }
    return created;
  }, [allMedicines, userId]);

  const updateMedicine = useCallback(async (medicineId: string, input: MedicineInput) => {
    if (!userId) throw new Error('Your session has expired. Please log in again.');
    const currentMedicine = allMedicines.find((medicine) => medicine.id === medicineId);
    const updated = await updateMedicineRecord(medicineId, userId, currentMedicine?.schedules[0]?.id, input);
    const nextMedicines = sortMedicinesByNextSchedule(
      allMedicines.map((medicine) => medicine.id === medicineId ? updated : medicine),
    );
    setAllMedicines(nextMedicines);
    setError(null);
    await reconcileNotifications(userId, nextMedicines);
    if (updated.care_circle_id) {
      void recordActivity(userId, {
        id: `med-upd:${updated.id}:${updated.updated_at}`,
        type: 'shared_medicine_updated',
        title: 'Shared medicine updated',
        body: `${updated.name} was updated in a Care Circle.`,
        createdAt: new Date().toISOString(),
        href: `/medicine/${updated.id}`,
      });
    }
    return updated;
  }, [allMedicines, userId]);

  const deleteMedicine = useCallback(async (medicineId: string) => {
    if (!userId) throw new Error('Your session has expired. Please log in again.');
    await deleteMedicineRecord(medicineId, userId);
    setAllMedicines((current) => current.filter((medicine) => medicine.id !== medicineId));
    setError(null);
    await cancelNotifications(userId, medicineId);
  }, [userId]);

  const medicines = useMemo(
    () => allMedicines.filter((medicine) => medicine.care_circle_id === null),
    [allMedicines],
  );

  const value = useMemo<MedicineContextValue>(() => ({
    allMedicines,
    medicines,
    isLoading,
    error,
    refreshMedicines,
    createMedicine,
    updateMedicine,
    deleteMedicine,
  }), [allMedicines, createMedicine, deleteMedicine, error, isLoading, medicines, refreshMedicines, updateMedicine]);

  return <MedicineContext.Provider value={value}>{children}</MedicineContext.Provider>;
}

export function useMedicines() {
  const context = useContext(MedicineContext);
  if (!context) throw new Error('useMedicines must be used inside MedicineProvider');
  return context;
}
