import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MeddyButton } from '@/components/meddy-button';
import { MeddyMascot } from '@/components/meddy-mascot';
import { NotificationBell } from '@/components/notification-bell';
import { ScreenShell, sharedStyles } from '@/components/screen-shell';
import { Palette } from '@/constants/theme';
import { useAppState } from '@/context/app-state';

const settings = [
  { symbol: '○', label: 'Account' },
  { symbol: 'Aa', label: 'Accessibility' },
  { symbol: '!', label: 'Notifications' },
  { symbol: '?', label: 'Help' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { logout, userName } = useAppState();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  async function handleLogout() {
    setLogoutError('');
    setIsLoggingOut(true);
    const result = await logout();
    setIsLoggingOut(false);
    if (result.error) setLogoutError(result.error);
  }

  return (
    <ScreenShell title="Profile" subtitle="Manage your account and preferences." rightAction={<NotificationBell />}>
      <View style={styles.profileCard}><MeddyMascot state="profile" style={styles.mascot} /><View style={styles.profileCopy}>{userName ? <Text style={styles.name}>{userName}</Text> : <Text style={styles.name}>Your account</Text>}<Text style={styles.accountHint}>{userName ? 'Account name' : 'Your name will appear after account creation.'}</Text></View></View>
      <Text style={sharedStyles.sectionTitle}>Settings</Text>
      <View style={styles.menu}>{settings.map((item, index) => <Pressable key={item.label} style={({ pressed }) => [styles.row, index < settings.length - 1 && styles.divider, pressed && styles.pressed]}><View style={styles.icon}><Text style={styles.iconText}>{item.symbol}</Text></View><Text style={styles.rowLabel}>{item.label}</Text><Text style={styles.chevron}>›</Text></Pressable>)}</View>
      {logoutError ? <Text accessibilityRole="alert" style={styles.error}>{logoutError}</Text> : null}
      {__DEV__ ? (
        <MeddyButton
          label="Notification diagnostics (dev)"
          onPress={() => router.push('/dev/notifications' as Href)}
          variant="secondary"
          style={styles.logout}
        />
      ) : null}
      <MeddyButton label={isLoggingOut ? 'Logging Out…' : 'Log Out'} onPress={handleLogout} disabled={isLoggingOut} variant="danger" style={styles.logout} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  profileCard: { minHeight: 126, borderRadius: 26, backgroundColor: Palette.softPink, borderWidth: 1, borderColor: Palette.border, padding: 16, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }, mascot: { width: 94, height: 102 }, profileCopy: { flex: 1, marginLeft: 12 }, name: { color: Palette.text, fontSize: 22, fontWeight: '800' }, accountHint: { color: Palette.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 6 },
  menu: { borderRadius: 24, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 18 }, row: { minHeight: 72, flexDirection: 'row', alignItems: 'center' }, divider: { borderBottomWidth: 1, borderBottomColor: Palette.border }, icon: { width: 40, height: 40, borderRadius: 14, backgroundColor: Palette.softPink, alignItems: 'center', justifyContent: 'center' }, iconText: { color: Palette.strongPink, fontSize: 15, fontWeight: '800' }, rowLabel: { flex: 1, marginLeft: 13, color: Palette.text, fontSize: 16, fontWeight: '700' }, chevron: { color: Palette.strongPink, fontSize: 29 }, pressed: { opacity: 0.65 }, error: { color: Palette.danger, fontSize: 14, lineHeight: 20, fontWeight: '700', marginTop: 18, textAlign: 'center' }, logout: { marginTop: 26 },
});
