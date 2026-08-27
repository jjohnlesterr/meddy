import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField } from '@/components/form-field';
import { MeddyButton } from '@/components/meddy-button';
import { MeddyLogo } from '@/components/meddy-logo';
import { MeddyMascot } from '@/components/meddy-mascot';
import { MaxContentWidth, Palette } from '@/constants/theme';
import { useAppState } from '@/context/app-state';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAppState();
  const [name, setName] = useState(''); const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);

  async function submit() {
    setError('');
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Please complete all fields.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    const result = await signUp(name, email, password);
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setNeedsEmailVerification(result.requiresEmailVerification);
  }

  if (needsEmailVerification) {
    return (
      <SafeAreaView style={styles.verificationScreen}>
        <View style={styles.verificationCard}>
          <MeddyLogo style={styles.logo} />
          <MeddyMascot state="caring" style={styles.verificationMascot} />
          <Text style={styles.verificationTitle}>Check your email</Text>
          <Text style={styles.verificationText}>We sent a verification link to {email.trim()}. Confirm your email, then return to Meddy and log in.</Text>
          <MeddyButton label="Go to Log In" onPress={() => router.replace('/login' as Href)} style={styles.verificationButton} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"><SafeAreaView style={styles.safeArea}><View style={styles.content}>
        <MeddyLogo style={styles.logo} />
        <View style={styles.heading}><Text style={styles.eyebrow}>CREATE YOUR ACCOUNT</Text><Text style={styles.title}>Let’s get to know you.</Text><Text style={styles.subtitle}>You can add medicines and invite trusted people after your account is created.</Text></View>
        <View style={styles.form}>
          <FormField label="Full Name" value={name} onChangeText={setName} placeholder="Your full name" autoCapitalize="words" autoComplete="name" />
          <FormField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <FormField label="Password" value={password} onChangeText={setPassword} placeholder="Create a password" secureTextEntry autoComplete="new-password" />
          <FormField label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Enter it again" secureTextEntry autoComplete="new-password" />
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <MeddyButton label={isSubmitting ? 'Creating Account…' : 'Create Account'} onPress={submit} disabled={isSubmitting} style={styles.button} />
        </View>
        <View style={styles.linkRow}><Text style={styles.linkPrompt}>Already have an account?</Text><Pressable accessibilityRole="link" onPress={() => router.replace('/login' as Href)}><Text style={styles.link}>Log In</Text></Pressable></View>
      </View></SafeAreaView></ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.white }, scroll: { flexGrow: 1 }, safeArea: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 30 }, content: { width: '100%', maxWidth: MaxContentWidth },
  logo: { width: 66, height: 66, alignSelf: 'center', marginBottom: 18 }, heading: { backgroundColor: Palette.softPink, borderRadius: 26, borderWidth: 1, borderColor: Palette.border, padding: 22 }, eyebrow: { color: Palette.strongPink, fontSize: 12, letterSpacing: 1, fontWeight: '800' }, title: { color: Palette.text, fontSize: 28, lineHeight: 35, fontWeight: '800', marginTop: 7 }, subtitle: { color: Palette.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 8 },
  form: { gap: 17, marginTop: 24 }, error: { color: Palette.danger, fontSize: 14, fontWeight: '700' }, button: { marginTop: 4 }, linkRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 20 }, linkPrompt: { color: Palette.textSecondary, fontSize: 15 }, link: { color: Palette.strongPink, fontSize: 15, fontWeight: '800', paddingVertical: 8 },
  verificationScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.white, padding: 24 }, verificationCard: { width: '100%', maxWidth: MaxContentWidth, alignItems: 'center', backgroundColor: Palette.softPink, borderRadius: 28, borderWidth: 1, borderColor: Palette.border, padding: 26 }, verificationMascot: { width: 150, height: 180 }, verificationTitle: { color: Palette.text, fontSize: 27, lineHeight: 34, fontWeight: '800', textAlign: 'center' }, verificationText: { color: Palette.textSecondary, fontSize: 16, lineHeight: 24, textAlign: 'center', marginTop: 10 }, verificationButton: { alignSelf: 'stretch', marginTop: 24 },
});
