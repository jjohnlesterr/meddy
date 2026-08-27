import type { Session, User } from '@supabase/supabase-js';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { executeSupabaseRequest, supabase, supabaseConfigurationError } from '@/lib/supabase';

export type OnboardingPreference = 'self' | 'caregiver';

export type Profile = {
  id: string;
  full_name: string;
  onboarding_type: OnboardingPreference | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
};

type AuthActionResult = { error: string | null };
type SignUpResult = AuthActionResult & { requiresEmailVerification: boolean };

type AppStateValue = {
  session: Session | null;
  profile: Profile | null;
  userName: string | null;
  onboardingPreference: OnboardingPreference | null;
  isInitializing: boolean;
  isProfileLoading: boolean;
  profileError: string | null;
  configurationError: string | null;
  signUp: (fullName: string, email: string, password: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  requestPasswordReset: (email: string) => Promise<AuthActionResult>;
  completeOnboarding: (preference: OnboardingPreference) => Promise<AuthActionResult>;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<AuthActionResult>;
};

const AppStateContext = createContext<AppStateValue | null>(null);

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function AppStateProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const loadProfile = useCallback(async (user: User, fullName?: string) => {
    const client = supabase;
    if (!client) return;
    setIsProfileLoading(true);
    setProfileError(null);

    try {
      const { data, error } = await executeSupabaseRequest(() =>
        client.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      );
      if (error) throw error;

      if (data) {
        setProfile(data as Profile);
        return;
      }

      const nameFromMetadata = typeof user.user_metadata.full_name === 'string' ? user.user_metadata.full_name : '';
      const { data: created, error: createError } = await executeSupabaseRequest(() =>
        client
          .from('profiles')
          .upsert({ id: user.id, full_name: fullName?.trim() || nameFromMetadata }, { onConflict: 'id' })
          .select('*')
          .single(),
      );

      if (createError) throw createError;
      setProfile(created as Profile);
    } catch (error) {
      setProfile(null);
      setProfileError(messageFromError(error));
    } finally {
      setIsProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user);
  }, [loadProfile, session]);

  useEffect(() => {
    const client = supabase;
    if (!client || Platform.OS === 'web') return;

    if (AppState.currentState === 'active') client.auth.startAutoRefresh();
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });

    return () => {
      appStateSubscription.remove();
      client.auth.stopAutoRefresh();
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
      if (!supabase) {
        if (active) setIsInitializing(false);
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (!active) return;

      if (error) {
        if (__DEV__) console.error('[Meddy auth] Could not restore the Supabase session.', error);
        setProfileError(error.message);
      } else {
        setSession(data.session);
        if (data.session) await loadProfile(data.session.user);
      }
      if (active) setIsInitializing(false);
    }

    void initialize();

    const subscription = supabase?.auth.onAuthStateChange((event, nextSession) => {
      if (!active || event === 'INITIAL_SESSION') return;
      setSession(nextSession);

      if (!nextSession) {
        setProfile(null);
        setProfileError(null);
        setIsProfileLoading(false);
        return;
      }

      setTimeout(() => {
        if (active) void loadProfile(nextSession.user);
      }, 0);
    }).data.subscription;

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [loadProfile]);

  const signUp = useCallback(async (fullName: string, email: string, password: string): Promise<SignUpResult> => {
    if (!supabase) return { error: supabaseConfigurationError, requiresEmailVerification: false };

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });

    if (error) return { error: error.message, requiresEmailVerification: false };
    if (!data.user) return { error: 'We could not create your account. Please try again.', requiresEmailVerification: false };

    if (!data.session) {
      return { error: null, requiresEmailVerification: true };
    }

    setSession(data.session);
    await loadProfile(data.user, fullName);
    return { error: null, requiresEmailVerification: false };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthActionResult> => {
    if (!supabase) return { error: supabaseConfigurationError };

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) return { error: error.message };
    setSession(data.session);
    await loadProfile(data.user);
    return { error: null };
  }, [loadProfile]);

  const requestPasswordReset = useCallback(async (email: string): Promise<AuthActionResult> => {
    if (!supabase) return { error: supabaseConfigurationError };
    if (!email.trim()) return { error: 'Enter your email address first.' };
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    return { error: error?.message ?? null };
  }, []);

  const completeOnboarding = useCallback(async (preference: OnboardingPreference): Promise<AuthActionResult> => {
    const client = supabase;
    if (!client) return { error: supabaseConfigurationError };
    if (!session?.user) return { error: 'Your session has expired. Please log in again.' };

    try {
      const { data, error } = await executeSupabaseRequest(() =>
        client
          .from('profiles')
          .update({ onboarding_type: preference, onboarding_completed: true })
          .eq('id', session.user.id)
          .select('*')
          .single(),
      );

      if (error) return { error: error.message };
      setProfile(data as Profile);
      return { error: null };
    } catch (error) {
      return { error: messageFromError(error) };
    }
  }, [session]);

  const logout = useCallback(async (): Promise<AuthActionResult> => {
    if (!supabase) return { error: supabaseConfigurationError };
    const { error } = await supabase.auth.signOut();
    if (error) return { error: error.message };

    setSession(null);
    setProfile(null);
    return { error: null };
  }, []);

  const value = useMemo<AppStateValue>(() => ({
    session,
    profile,
    userName: profile?.full_name || null,
    onboardingPreference: profile?.onboarding_type || null,
    isInitializing,
    isProfileLoading,
    profileError,
    configurationError: supabaseConfigurationError,
    signUp,
    signIn,
    requestPasswordReset,
    completeOnboarding,
    refreshProfile,
    logout,
  }), [completeOnboarding, isInitializing, isProfileLoading, logout, profile, profileError, refreshProfile, requestPasswordReset, session, signIn, signUp]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState must be used inside AppStateProvider');
  return context;
}
