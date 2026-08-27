import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField } from '@/components/form-field';
import { MeddyButton } from '@/components/meddy-button';
import { MeddyLogo } from '@/components/meddy-logo';
import { MeddyMascot } from '@/components/meddy-mascot';
import { Palette } from '@/constants/theme';
import { useAppState } from '@/context/app-state';

export default function LoginScreen() {
  const router = useRouter();
  const { requestPasswordReset, signIn } = useAppState();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    setError('');
    setMessage('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setIsSubmitting(true);
    const result = await signIn(email, password);
    setIsSubmitting(false);
    if (result.error) setError(result.error);
  }

  async function forgotPassword() {
    setError('');
    setMessage('');
    if (!email.trim()) {
      setError('Enter your email address first.');
      return;
    }

    setIsSubmitting(true);
    const result = await requestPasswordReset(email);
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMessage('Password reset instructions have been sent to your email.');
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.content}>
            <View style={styles.brandRow}><MeddyLogo style={styles.logo} /><Text style={styles.brand}>Meddy</Text></View>
            <View style={styles.top}><MeddyMascot state="default" style={styles.mascot} /><View><Text style={styles.eyebrow}>WELCOME BACK</Text><Text style={styles.title}>Log in to Meddy</Text></View></View>
            <Text style={styles.subtitle}>Your medicine plan and Care Circle will be here when you return.</Text>
            <View style={styles.form}>
              <FormField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
              <FormField label="Password" value={password} onChangeText={setPassword} placeholder="Enter your password" secureTextEntry autoComplete="current-password" />
              <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={forgotPassword} style={styles.forgotButton}><Text style={styles.forgotText}>Forgot password?</Text></Pressable>
              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
              {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
              <MeddyButton label={isSubmitting ? 'Logging In…' : 'Log In'} onPress={submit} disabled={isSubmitting} style={styles.button} />
            </View>
            <View style={styles.linkRow}><Text style={styles.linkPrompt}>Don&apos;t have an account?</Text><Pressable accessibilityRole="link" onPress={() => router.push('/signup' as Href)}><Text style={styles.link}>Create one</Text></Pressable></View>
          </View>
        </SafeAreaView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.white }, scroll: { flexGrow: 1 }, safeArea: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 28 }, content: { width: '100%', maxWidth: 520, marginVertical: 'auto' },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 18 }, logo: { width: 60, height: 60 }, brand: { color: Palette.text, fontSize: 25, fontWeight: '800' },
  top: { flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.softPink, borderRadius: 26, paddingHorizontal: 20, borderWidth: 1, borderColor: Palette.border }, mascot: { width: 105, height: 130 }, eyebrow: { color: Palette.strongPink, fontSize: 12, fontWeight: '800', letterSpacing: 1 }, title: { color: Palette.text, fontSize: 27, lineHeight: 34, fontWeight: '800', marginTop: 5 },
  subtitle: { color: Palette.textSecondary, fontSize: 16, lineHeight: 24, marginTop: 22 }, form: { gap: 18, marginTop: 25 }, forgotButton: { alignSelf: 'flex-end', minHeight: 34, justifyContent: 'center', marginTop: -10 }, forgotText: { color: Palette.strongPink, fontSize: 14, fontWeight: '800' }, error: { color: Palette.danger, fontSize: 14, lineHeight: 20, fontWeight: '700' }, message: { color: Palette.textSecondary, backgroundColor: Palette.softPink, borderRadius: 14, padding: 12, fontSize: 14, lineHeight: 20, fontWeight: '700' }, button: { marginTop: 4 }, linkRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 24 }, linkPrompt: { color: Palette.textSecondary, fontSize: 15 }, link: { color: Palette.strongPink, fontSize: 15, fontWeight: '800', paddingVertical: 8 },
});
