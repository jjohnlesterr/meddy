import {
  NunitoSans_400Regular,
  NunitoSans_500Medium,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
  NunitoSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/nunito-sans';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AuthLoadingScreen } from '@/components/auth-loading-screen';
import { NotificationResponseObserver } from '@/components/notification-response-observer';
import { Palette } from '@/constants/theme';
import { MeddyActivityProvider } from '@/context/activity-context';
import { AppStateProvider, useAppState } from '@/context/app-state';
import { CareCircleProvider } from '@/context/care-circle-context';
import { MedicineProvider } from '@/context/medicine-context';

SplashScreen.preventAutoHideAsync();

const meddyTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: Palette.strongPink, background: Palette.white,
    card: Palette.white, text: Palette.text, border: Palette.border },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    NunitoSans_400Regular,
    NunitoSans_500Medium,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
    NunitoSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (fontError && __DEV__) console.error('[Meddy] Nunito Sans failed to load, using system fallback.', fontError);
  // Keep the native splash screen up until fonts resolve (loaded or errored) so no
  // frame is ever painted with the system-font fallback — this is what avoids the
  // font-swap flash/layout-jump.
  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider value={meddyTheme}>
      <AppStateProvider>
        <CareCircleProvider>
          <MedicineProvider>
            <MeddyActivityProvider>
              <StatusBar style="dark" />
              <NotificationResponseObserver />
              <RootNavigator />
            </MeddyActivityProvider>
          </MedicineProvider>
        </CareCircleProvider>
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
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
      </Stack.Protected>

      <Stack.Protected guard={isAuthenticated && Boolean(profile) && !onboardingComplete}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>

      <Stack.Protected guard={isAuthenticated && Boolean(profile) && onboardingComplete}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="care/create" />
        <Stack.Screen name="care/join" />
        <Stack.Screen name="care/[id]" />
        <Stack.Screen name="care/settings/[id]" />
        <Stack.Screen name="medicine/add" />
        <Stack.Screen name="medicine/[id]" />
        <Stack.Screen name="medicine/edit/[id]" />
        {/* dev/notifications is intentionally NOT declared here: it is a
            development-only screen at src/app/dev/notifications.tsx that Expo
            Router auto-discovers. Declaring it explicitly (and conditionally)
            produced "No route named dev/notifications exists in nested children".
            The screen itself renders a stub when __DEV__ is false. */}
      </Stack.Protected>

      <Stack.Protected guard={isAuthenticated && !profile && !isProfileLoading}>
        <Stack.Screen name="profile-error" />
      </Stack.Protected>
    </Stack>
  );
}
