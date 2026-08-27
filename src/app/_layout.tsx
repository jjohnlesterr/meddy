import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AuthLoadingScreen } from '@/components/auth-loading-screen';
import { Palette } from '@/constants/theme';
import { AppStateProvider, useAppState } from '@/context/app-state';

SplashScreen.preventAutoHideAsync();

const meddyTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: Palette.strongPink, background: Palette.white,
    card: Palette.white, text: Palette.text, border: Palette.border },
};

export default function RootLayout() {
  useEffect(() => { SplashScreen.hideAsync(); }, []);
  return (
    <ThemeProvider value={meddyTheme}>
      <AppStateProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AppStateProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { isInitializing, isProfileLoading, profile, session } = useAppState();

  if (isInitializing) return <AuthLoadingScreen message="Checking your session…" />;
  if (session && isProfileLoading) return <AuthLoadingScreen message="Loading your profile…" />;

  const isAuthenticated = Boolean(session);
  const onboardingComplete = profile?.onboarding_completed === true;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Palette.white } }}>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
      </Stack.Protected>

      <Stack.Protected guard={isAuthenticated && Boolean(profile) && !onboardingComplete}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>

      <Stack.Protected guard={isAuthenticated && Boolean(profile) && onboardingComplete}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="care" />
      </Stack.Protected>

      <Stack.Protected guard={isAuthenticated && !profile && !isProfileLoading}>
        <Stack.Screen name="profile-error" />
      </Stack.Protected>
    </Stack>
  );
}
