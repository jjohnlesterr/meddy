import * as DocumentPicker from 'expo-document-picker';
import { RecordingPresets, createAudioPlayer, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState, type AudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette } from '@/constants/theme';
import { FontFamily } from '@/constants/typography';
import { useAppState } from '@/context/app-state';
import { getPersonalizedAudioSignedUrl, uploadPersonalizedAudio } from '@/lib/personalized-audio-storage';
import type { PersonalizedAudioSource } from '@/types/medicine';

const AUDIO_DIR = `${FileSystem.documentDirectory}meddy-personalized-audio/`;
const MAX_RECORDING_SECONDS = 30;

export type PersonalizedAudioValue = {
  /** Device-local cache only — not synced. */
  uri: string | null;
  /** Canonical, cross-device Supabase Storage object path. */
  storagePath: string | null;
  durationSeconds: number | null;
  source: PersonalizedAudioSource | null;
  label: string | null;
};

type PendingClip = {
  localUri: string;
  source: PersonalizedAudioSource;
  label: string;
  durationSeconds: number;
};

type PersonalizedReminderAudioProps = {
  value: PersonalizedAudioValue;
  onChange: (value: PersonalizedAudioValue) => void;
  /** True when rendered inside another section (e.g. the Reminder Sound modal), which already supplies its own "Personalized" label — skips this component's own heading/note. */
  embedded?: boolean;
};

async function ensureAudioDir() {
  const info = await FileSystem.getInfoAsync(AUDIO_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(AUDIO_DIR, { intermediates: true });
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

const LABEL_MAX_LENGTH = 100;

/** Clamps an auto-derived label (e.g. a picked file's name) to the DB limit. Not a typed field — an occasional very long filename is truncated for display rather than blocking a perfectly valid audio pick. */
function clampLabel(label: string) {
  const trimmed = label.trim();
  return trimmed.length > LABEL_MAX_LENGTH ? `${trimmed.slice(0, LABEL_MAX_LENGTH - 1)}…` : trimmed;
}

/** Loads `uri` just far enough to read its duration, then releases the player. Used to validate a picked file before accepting it — never plays audio. */
function readAudioDurationSeconds(uri: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let player: AudioPlayer | null = null;
    let subscription: { remove: () => void } | null = null;

    const timeout = setTimeout(() => finish(() => reject(new Error('Timed out reading the audio file.'))), 8000);

    function finish(action: () => void) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      subscription?.remove();
      player?.release();
      action();
    }

    try {
      player = createAudioPlayer({ uri });
      subscription = player.addListener('playbackStatusUpdate', (status) => {
        if (status.isLoaded && status.duration > 0) finish(() => resolve(status.duration));
      });
    } catch (error) {
      finish(() => reject(error));
    }
  });
}

export function PersonalizedReminderAudio({ value, onChange, embedded = false }: PersonalizedReminderAudioProps) {
  const { session } = useAppState();
  const userId = session?.user.id;
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pending, setPending] = useState<PendingClip | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const player = useRef<AudioPlayer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    return () => {
      player.current?.release();
    };
  }, []);

  useEffect(() => {
    if (!recorderState.isRecording) return;
    if (recorderState.durationMillis / 1000 >= MAX_RECORDING_SECONDS) {
      void stopRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorderState.durationMillis, recorderState.isRecording]);

  function releasePreviewPlayer() {
    player.current?.release();
    player.current = null;
    setIsPlaying(false);
  }

  async function pickFromDevice() {
    setError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      setIsBusy(true);
      const durationSeconds = await readAudioDurationSeconds(asset.uri);
      if (durationSeconds > MAX_RECORDING_SECONDS) {
        setError(`That file is ${Math.round(durationSeconds)}s long. Please choose an audio file ${MAX_RECORDING_SECONDS} seconds or shorter.`);
        return;
      }

      await ensureAudioDir();
      const destination = `${AUDIO_DIR}${Date.now()}-${sanitizeFileName(asset.name)}`;
      await FileSystem.copyAsync({ from: asset.uri, to: destination });
      releasePreviewPlayer();
      setPending({ localUri: destination, source: 'picked', label: clampLabel(asset.name), durationSeconds: Math.round(durationSeconds) });
    } catch (err) {
      if (__DEV__) console.warn('[Meddy] Could not import audio from device.', err);
      setError('Could not import that audio file. Please try a different file.');
    } finally {
      setIsBusy(false);
    }
  }

  async function startRecording() {
    setError('');
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone permission is needed to record a voice reminder.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (err) {
      if (__DEV__) console.warn('[Meddy] Could not start recording.', err);
      setError('Could not start recording. Please try again.');
    }
  }

  async function stopRecording() {
    const durationSeconds = Math.round(recorderState.durationMillis / 1000);
    try {
      await recorder.stop();
      const recordedUri = recorder.uri;
      if (!recordedUri) return;

      setIsBusy(true);
      await ensureAudioDir();
      const destination = `${AUDIO_DIR}${Date.now()}-voice-reminder.m4a`;
      await FileSystem.copyAsync({ from: recordedUri, to: destination });
      releasePreviewPlayer();
      setPending({ localUri: destination, source: 'recorded', label: 'Voice reminder', durationSeconds: Math.max(1, durationSeconds) });
    } catch (err) {
      if (__DEV__) console.warn('[Meddy] Could not save the recording.', err);
      setError('Could not save the recording. Please try again.');
    } finally {
      setIsBusy(false);
    }
  }

  function discardPending() {
    releasePreviewPlayer();
    setPending(null);
    setError('');
  }

  async function confirmPending() {
    if (!pending) return;
    if (!userId) {
      setError('Your session has expired. Please log in again.');
      return;
    }
    setError('');
    setIsUploading(true);
    try {
      const storagePath = await uploadPersonalizedAudio(userId, pending.localUri);
      releasePreviewPlayer();
      onChange({
        uri: pending.localUri,
        storagePath,
        durationSeconds: pending.durationSeconds,
        source: pending.source,
        label: pending.label,
      });
      setPending(null);
    } catch (err) {
      if (__DEV__) console.warn('[Meddy] Could not upload personalized audio.', err);
      setError('Could not save this audio right now. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }

  function removeAudio() {
    setError('');
    releasePreviewPlayer();
    onChange({ uri: null, storagePath: null, durationSeconds: null, source: null, label: null });
  }

  async function playLocal(uri: string) {
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    player.current?.release();
    player.current = createAudioPlayer({ uri });
    player.current.play();
    setIsPlaying(true);
  }

  async function togglePendingPreview() {
    if (!pending) return;
    if (isPlaying) {
      player.current?.pause();
      setIsPlaying(false);
      return;
    }
    try {
      await playLocal(pending.localUri);
    } catch (err) {
      if (__DEV__) console.warn('[Meddy] Could not preview this clip.', err);
    }
  }

  async function toggleSavedPreview() {
    if (isPlaying) {
      player.current?.pause();
      setIsPlaying(false);
      return;
    }
    try {
      if (value.uri) {
        await playLocal(value.uri);
        return;
      }
      if (value.storagePath) {
        setIsBusy(true);
        const signedUrl = await getPersonalizedAudioSignedUrl(value.storagePath);
        setIsBusy(false);
        await playLocal(signedUrl);
      }
    } catch (err) {
      setIsBusy(false);
      if (__DEV__) console.warn('[Meddy] Could not preview personalized audio.', err);
      setError('Could not play this audio right now.');
    }
  }

  const isRecording = recorderState.isRecording;
  const elapsedSeconds = Math.min(MAX_RECORDING_SECONDS, Math.floor(recorderState.durationMillis / 1000));
  const hasSavedAudio = Boolean(value.storagePath || value.uri);

  return (
    <View style={[styles.section, embedded && styles.sectionEmbedded]}>
      {embedded ? null : (
        <>
          <Text style={styles.sectionTitle}>Personalized</Text>
          <Text style={styles.note}>
            Optional — plays in the app when you view this medicine, and syncs so Care Circle members can play it too. Your Meddy alarm above still fires the notification sound.
          </Text>
        </>
      )}

      {isRecording ? (
        <View style={styles.recordingCard}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>Recording… {elapsedSeconds}s / {MAX_RECORDING_SECONDS}s</Text>
        </View>
      ) : null}

      {pending ? (
        <View style={styles.selectedCard}>
          <View style={styles.selectedCopy}>
            <Text style={styles.selectedLabel}>{pending.label}</Text>
            <Text style={styles.selectedSource}>
              {pending.source === 'recorded' ? 'New voice recording' : 'New imported file'} · {pending.durationSeconds}s
            </Text>
          </View>
          <Pressable
            accessibilityLabel={isPlaying ? 'Pause preview' : 'Preview'}
            accessibilityRole="button"
            disabled={isUploading}
            onPress={() => void togglePendingPreview()}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <Text style={styles.iconButtonText}>{isPlaying ? '⏸' : '▶'}</Text>
          </Pressable>
        </View>
      ) : hasSavedAudio ? (
        <View style={styles.selectedCard}>
          <View style={styles.selectedCopy}>
            <Text style={styles.selectedLabel}>{value.label ?? 'Personalized audio'}</Text>
            <Text style={styles.selectedSource}>
              {value.source === 'recorded' ? 'Voice recording' : 'Imported file'}
              {value.durationSeconds ? ` · ${value.durationSeconds}s` : ''}
            </Text>
          </View>
          <Pressable
            accessibilityLabel={isPlaying ? 'Pause preview' : 'Preview'}
            accessibilityRole="button"
            disabled={isBusy}
            onPress={() => void toggleSavedPreview()}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            {isBusy ? <ActivityIndicator color={Palette.strongPink} size="small" /> : <Text style={styles.iconButtonText}>{isPlaying ? '⏸' : '▶'}</Text>}
          </Pressable>
          <Pressable accessibilityLabel="Remove personalized audio" accessibilityRole="button" onPress={removeAudio} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <Text style={styles.iconButtonText}>✕</Text>
          </Pressable>
        </View>
      ) : null}

      {pending ? (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={isUploading}
            onPress={() => void confirmPending()}
            style={({ pressed }) => [styles.actionButton, styles.confirmButton, pressed && styles.pressed, isUploading && styles.disabled]}>
            {isUploading ? <ActivityIndicator color={Palette.white} size="small" /> : <Text style={styles.confirmButtonText}>Use this recording</Text>}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isUploading}
            onPress={discardPending}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed, isUploading && styles.disabled]}>
            <Text style={styles.actionButtonText}>Discard</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={isBusy || isRecording}
            onPress={() => void pickFromDevice()}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed, (isBusy || isRecording) && styles.disabled]}>
            <Text style={styles.actionButtonText}>Choose audio from device</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={isBusy}
            onPress={() => void (isRecording ? stopRecording() : startRecording())}
            style={({ pressed }) => [
              styles.actionButton,
              isRecording && styles.recordingActive,
              pressed && styles.pressed,
              isBusy && styles.disabled,
            ]}>
            <Text style={[styles.actionButtonText, isRecording && styles.recordingActiveText]}>
              {isRecording ? `Stop recording (${elapsedSeconds}s / ${MAX_RECORDING_SECONDS}s)` : 'Record a voice reminder'}
            </Text>
          </Pressable>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 11, marginTop: 4 },
  sectionEmbedded: { gap: 9, marginTop: 0 },
  sectionTitle: { color: Palette.text, fontFamily: FontFamily.extraBold, fontSize: 18, lineHeight: 24 },
  note: { color: Palette.textSecondary, fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18, marginTop: -4 },
  recordingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#F3CACA',
    borderRadius: 16,
    backgroundColor: '#FDEDED',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Palette.danger },
  recordingText: { color: Palette.danger, fontFamily: FontFamily.bold, fontSize: 14 },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 16,
    backgroundColor: Palette.softPink,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  selectedCopy: { flex: 1 },
  selectedLabel: { color: Palette.text, fontFamily: FontFamily.bold, fontSize: 15 },
  selectedSource: { color: Palette.textSecondary, fontFamily: FontFamily.regular, fontSize: 12, marginTop: 2 },
  iconButton: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.white, borderWidth: 1, borderColor: Palette.border },
  iconButtonText: { color: Palette.strongPink, fontSize: 15 },
  actions: { gap: 9 },
  actionButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Palette.border, borderRadius: 15, backgroundColor: Palette.white, paddingHorizontal: 14 },
  actionButtonText: { color: Palette.strongPink, fontFamily: FontFamily.bold, fontSize: 15 },
  confirmButton: { backgroundColor: Palette.strongPink, borderColor: Palette.strongPink },
  confirmButtonText: { color: Palette.white, fontFamily: FontFamily.bold, fontSize: 15 },
  recordingActive: { borderColor: Palette.danger, backgroundColor: '#FDEDED' },
  recordingActiveText: { color: Palette.danger },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
  error: { color: Palette.danger, fontFamily: FontFamily.bold, fontSize: 13, lineHeight: 18 },
});
