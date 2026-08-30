import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/components/form-field';
import { KeyboardSafeFormScreen } from '@/components/keyboard-safe-form-screen';
import { MeddyButton } from '@/components/meddy-button';
import { MeddyMascot } from '@/components/meddy-mascot';
import { Palette } from '@/constants/theme';
import { FontFamily } from '@/constants/typography';
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
    <KeyboardSafeFormScreen contentStyle={styles.content}>
      <View style={styles.top}><MeddyMascot state="success" style={styles.mascot} /><View style={styles.headingCopy}><Text style={styles.eyebrow}>WELCOME BACK</Text><Text style={styles.title}>Sign in to Meddy</Text></View></View>
      <Text style={styles.subtitle}>Manage your reminders with ease.</Text>
      <View style={styles.form}>
        <FormField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <FormField label="Password" value={password} onChangeText={setPassword} placeholder="Enter your password" secureTextEntry showPasswordToggle autoComplete="current-password" />
        <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={forgotPassword} style={styles.forgotButton}><Text style={styles.forgotText}>Forgot password?</Text></Pressable>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
        <MeddyButton label={isSubmitting ? 'Logging In…' : 'Log In'} onPress={submit} disabled={isSubmitting} style={styles.button} />
      </View>
      <View style={styles.linkRow}><Text style={styles.linkPrompt}>Don&apos;t have an account?</Text><Pressable accessibilityRole="link" onPress={() => router.push('/signup' as Href)}><Text style={styles.link}>Create one</Text></Pressable></View>
    </KeyboardSafeFormScreen>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24 },
  top: { minHeight: 116, flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.softPink, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: Palette.border, overflow: 'hidden' }, mascot: { width: 94, height: 104 }, headingCopy: { flex: 1, marginLeft: 8 }, eyebrow: { color: Palette.strongPink, fontSize: 12, fontFamily: FontFamily.extraBold, letterSpacing: 1 }, title: { color: Palette.text, fontSize: 25, lineHeight: 31, fontFamily: FontFamily.extraBold, marginTop: 4 },
  subtitle: { color: Palette.textSecondary, fontSize: 16, lineHeight: 24, marginTop: 18, fontFamily: FontFamily.regular }, form: { gap: 18, marginTop: 22 }, forgotButton: { alignSelf: 'flex-end', minHeight: 34, justifyContent: 'center', marginTop: -10 }, forgotText: { color: Palette.strongPink, fontSize: 14, fontFamily: FontFamily.extraBold }, error: { color: Palette.danger, fontSize: 14, lineHeight: 20, fontFamily: FontFamily.bold }, message: { color: Palette.textSecondary, backgroundColor: Palette.softPink, borderRadius: 14, padding: 12, fontSize: 14, lineHeight: 20, fontFamily: FontFamily.bold }, button: { marginTop: 4 }, linkRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 24 }, linkPrompt: { color: Palette.textSecondary, fontSize: 15, fontFamily: FontFamily.regular }, link: { color: Palette.strongPink, fontSize: 15, fontFamily: FontFamily.extraBold, paddingVertical: 8 },
});
