import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Image } from 'expo-image';
import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { MeddyButton } from '@/components/meddy-button';
import { ScreenShell, sharedStyles } from '@/components/screen-shell';
import { Palette } from '@/constants/theme';
import { FontFamily } from '@/constants/typography';
import { useCareCircles } from '@/context/care-circle-context';
import { useMedicines } from '@/context/medicine-context';
import { getMedicinePhotoSignedUrl } from '@/lib/medicine-photo-storage';
import { formatMedicineTime, formatScheduleDays, medicineDosageLabel } from '@/lib/medicines';
import { getPersonalizedAudioSignedUrl } from '@/lib/personalized-audio-storage';
import type { MedicineSchedule } from '@/types/medicine';

// Displays a medicine's photo (if any) and lets it be tapped open to a
// larger preview. Uses a short-lived signed URL — the medicine-photos bucket
// is private, so only a caller RLS actually authorizes (the owner, or a
// permitted Care Circle member — see supabase/medicine_photos.sql) can view
// it. Renders nothing if there is no photo, rather than an empty placeholder.
function MedicinePhotoCard({ photoStoragePath }: { photoStoragePath: string }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    let active = true;
    getMedicinePhotoSignedUrl(photoStoragePath)
      .then((url) => {
        if (active) setSignedUrl(url);
      })
      .catch((error) => {
        if (__DEV__) console.warn('[Meddy] Could not load medicine photo.', error);
        if (active) setUnavailable(true);
      });
    return () => {
      active = false;
    };
  }, [photoStoragePath]);

  if (unavailable) return null;

  return (
    <>
      <Pressable
        accessibilityLabel="View larger photo"
        accessibilityRole="imagebutton"
        disabled={!signedUrl}
        onPress={() => setIsPreviewOpen(true)}
        style={styles.photoCard}>
        {signedUrl ? (
          <Image source={{ uri: signedUrl }} style={styles.photoImage} contentFit="cover" />
        ) : (
          <View style={[styles.photoImage, styles.photoLoading]}>
            <ActivityIndicator color={Palette.strongPink} />
          </View>
        )}
      </Pressable>

      <Modal transparent animationType="fade" visible={isPreviewOpen} onRequestClose={() => setIsPreviewOpen(false)}>
        <Pressable accessibilityRole="button" onPress={() => setIsPreviewOpen(false)} style={styles.previewBackdrop}>
          {signedUrl ? <Image source={{ uri: signedUrl }} style={styles.previewImage} contentFit="contain" /> : null}
        </Pressable>
      </Modal>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

// Playback for a personalized reminder recording, visible to the owner and to
// any Care Circle member the Storage RLS policy authorizes (see
// supabase/medicine_personalized_audio_storage.sql). This never uses the
// clip as a native alarm sound — it only plays inside the app.
function PersonalizedAudioCard({ schedule }: { schedule: MedicineSchedule }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const player = useRef<AudioPlayer | null>(null);
  const signedUrl = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      player.current?.release();
    };
  }, []);

  async function ensureSignedUrl() {
    if (signedUrl.current) return signedUrl.current;
    const url = await getPersonalizedAudioSignedUrl(schedule.personalized_audio_storage_path!);
    signedUrl.current = url;
    return url;
  }

  async function togglePlay() {
    if (isPlaying) {
      player.current?.pause();
      setIsPlaying(false);
      return;
    }
    setIsLoading(true);
    setUnavailable(false);
    try {
      const url = await ensureSignedUrl();
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      player.current?.release();
      player.current = createAudioPlayer({ uri: url });
      player.current.play();
      setIsPlaying(true);
    } catch (error) {
      if (__DEV__) console.warn('[Meddy] Could not play personalized audio.', error);
      setUnavailable(true);
    } finally {
      setIsLoading(false);
    }
  }

  async function shareAudio() {
    try {
      const url = await ensureSignedUrl();
      await Share.share({ message: url });
    } catch (error) {
      if (__DEV__) console.warn('[Meddy] Could not share personalized audio.', error);
      setUnavailable(true);
    }
  }

  return (
    <View style={[sharedStyles.card, styles.audioCard]}>
      <View style={styles.audioCopy}>
        <Text style={styles.audioLabel}>{schedule.personalized_audio_label ?? 'Personalized reminder'}</Text>
        <Text style={styles.audioMeta}>
          {schedule.personalized_audio_source === 'recorded' ? 'Voice recording' : 'Imported audio'}
          {schedule.personalized_audio_duration_seconds ? ` · ${schedule.personalized_audio_duration_seconds}s` : ''}
        </Text>
        {unavailable ? <Text style={styles.audioUnavailable}>Personalized audio is unavailable right now.</Text> : null}
      </View>
      <Pressable accessibilityLabel={isPlaying ? 'Pause' : 'Play'} accessibilityRole="button" onPress={() => void togglePlay()} style={({ pressed }) => [styles.audioButton, pressed && styles.audioButtonPressed]}>
        {isLoading ? <ActivityIndicator color={Palette.strongPink} size="small" /> : <Text style={styles.audioButtonText}>{isPlaying ? '⏸' : '▶'}</Text>}
      </Pressable>
      <Pressable accessibilityLabel="Share or download" accessibilityRole="button" onPress={() => void shareAudio()} style={({ pressed }) => [styles.audioButton, pressed && styles.audioButtonPressed]}>
        <Text style={styles.audioButtonText}>⇪</Text>
      </Pressable>
    </View>
  );
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : 'We could not delete this medicine. Please try again.';
}

export default function MedicineDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[]; saved?: string | string[] }>();
  const medicineId = Array.isArray(params.id) ? params.id[0] : params.id;
  const saved = Array.isArray(params.saved) ? params.saved[0] : params.saved;
  const { allMedicines, isLoading, error: loadError, refreshMedicines, deleteMedicine } = useMedicines();
  const { circles } = useCareCircles();
  const medicine = allMedicines.find((item) => item.id === medicineId);
  const circle = circles.find((item) => item.id === medicine?.care_circle_id);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  async function confirmDelete() {
    if (!medicineId) return;
    setDeleteError('');
    setIsDeleting(true);
    try {
      await deleteMedicine(medicineId);
      router.replace((medicine?.care_circle_id ? `/care/${medicine.care_circle_id}` : '/medicines') as Href);
    } catch (error) {
      setDeleteError(messageFromError(error));
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <ScreenShell title="Medicine" onBack={() => router.back()}>
        <View style={[sharedStyles.card, styles.centered]}>
          <ActivityIndicator color={Palette.strongPink} size="large" />
          <Text style={styles.message}>Loading medicine…</Text>
        </View>
      </ScreenShell>
    );
  }

  if (!medicine) {
    return (
      <ScreenShell title="Medicine unavailable" onBack={() => router.back()}>
        <View style={[sharedStyles.card, styles.centered]}>
          <Text style={styles.error}>{loadError ?? 'This medicine could not be found.'}</Text>
          <MeddyButton label="Try Again" onPress={() => void refreshMedicines()} variant="secondary" style={styles.retry} />
        </View>
      </ScreenShell>
    );
  }

  const schedule = medicine.schedules[0];
  const canEdit = medicine.care_circle_id === null || circle?.role === 'owner' || circle?.role === 'admin' || circle?.role === 'caregiver';
  const canDelete = medicine.care_circle_id === null || circle?.role === 'owner' || circle?.role === 'admin';
  const successMessage = saved === 'created'
    ? 'Medicine and schedule saved.'
    : saved === 'updated'
      ? 'Changes saved.'
      : null;

  return (
    <ScreenShell title={medicine.name} subtitle={circle ? `${circle.name} · Shared medicine` : 'Medicine details'} onBack={() => router.back()}>
      {successMessage ? <Text accessibilityRole="alert" style={styles.success}>{successMessage}</Text> : null}

      {medicine.photo_storage_path ? <MedicinePhotoCard photoStoragePath={medicine.photo_storage_path} /> : null}

      <View style={[sharedStyles.card, styles.summaryCard]}>
        <View style={styles.summaryHeading}>
          <View style={styles.summaryCopy}>
            <Text style={styles.dosage}>{medicineDosageLabel(medicine)}</Text>
            <Text style={styles.form}>{medicine.form}</Text>
          </View>
          <View style={[styles.status, !medicine.active && styles.inactiveStatus]}>
            <Text style={[styles.statusText, !medicine.active && styles.inactiveStatusText]}>{medicine.active ? 'Active' : 'Inactive'}</Text>
          </View>
        </View>
        <View style={styles.timeCard}>
          <Text style={styles.timeLabel}>{formatScheduleDays(schedule)} schedule</Text>
          <Text style={styles.time}>{formatMedicineTime(schedule?.time_of_day)}</Text>
        </View>
      </View>

      <Text style={sharedStyles.sectionTitle}>Information</Text>
      <View style={[sharedStyles.card, styles.detailsCard]}>
        <DetailRow label="Instructions" value={medicine.instructions || 'None'} />
        <DetailRow label="Notes" value={medicine.notes || 'None'} />
        <DetailRow label="Days" value={formatScheduleDays(schedule)} />
      </View>

      {schedule?.personalized_audio_storage_path ? <PersonalizedAudioCard schedule={schedule} /> : null}

      {canEdit || canDelete ? <View style={styles.actions}>
        {canEdit ? <MeddyButton label="Edit" onPress={() => router.push(`/medicine/edit/${medicine.id}` as Href)} style={styles.actionButton} /> : null}
        {canDelete && !isConfirmingDelete ? (
          <MeddyButton label="Delete" onPress={() => setIsConfirmingDelete(true)} variant="danger" style={styles.actionButton} />
        ) : null}
      </View> : circle ? <Text style={styles.viewOnly}>View-only access</Text> : null}

      {isConfirmingDelete ? (
        <View style={[sharedStyles.card, styles.deleteCard]}>
          <Text style={styles.deleteTitle}>Delete this medicine?</Text>
          <Text style={styles.deleteText}>Its schedule will also be deleted. This cannot be undone.</Text>
          {deleteError ? <Text accessibilityRole="alert" style={styles.error}>{deleteError}</Text> : null}
          <View style={styles.deleteActions}>
            <MeddyButton label="Cancel" onPress={() => setIsConfirmingDelete(false)} disabled={isDeleting} variant="secondary" style={styles.actionButton} />
            <MeddyButton label={isDeleting ? 'Deleting…' : 'Confirm Delete'} onPress={() => void confirmDelete()} disabled={isDeleting} variant="danger" style={styles.actionButton} />
          </View>
        </View>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', gap: 14 },
  message: { color: Palette.textSecondary, fontFamily: FontFamily.regular, fontSize: 16 },
  retry: { minHeight: 50 },
  success: { color: '#39764F', backgroundColor: '#EAF7EF', borderRadius: 16, paddingHorizontal: 15, paddingVertical: 12, fontFamily: FontFamily.extraBold, fontSize: 14, lineHeight: 20, marginBottom: 14 },
  photoCard: { width: '100%', height: 200, borderRadius: 20, overflow: 'hidden', marginBottom: 14, backgroundColor: Palette.softPink },
  photoImage: { width: '100%', height: '100%' },
  photoLoading: { alignItems: 'center', justifyContent: 'center' },
  previewBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20, 18, 19, 0.92)' },
  previewImage: { width: '100%', height: '80%' },
  summaryCard: { backgroundColor: Palette.softPink },
  summaryHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  summaryCopy: { flex: 1 },
  dosage: { color: Palette.text, fontFamily: FontFamily.extraBold, fontSize: 21, lineHeight: 27 },
  form: { color: Palette.textSecondary, fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 21, marginTop: 4 },
  status: { borderRadius: 999, backgroundColor: '#EAF7EF', paddingHorizontal: 11, paddingVertical: 6 },
  inactiveStatus: { backgroundColor: '#F3F0F1' },
  statusText: { color: '#3E8057', fontFamily: FontFamily.extraBold, fontSize: 12 },
  inactiveStatusText: { color: Palette.textSecondary },
  timeCard: { borderTopWidth: 1, borderTopColor: Palette.border, marginTop: 18, paddingTop: 16 },
  timeLabel: { color: Palette.textSecondary, fontFamily: FontFamily.bold, fontSize: 13 },
  time: { color: Palette.text, fontFamily: FontFamily.extraBold, fontSize: 26, lineHeight: 33, marginTop: 3 },
  detailsCard: { paddingVertical: 4 },
  audioCard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  audioCopy: { flex: 1 },
  audioLabel: { color: Palette.text, fontFamily: FontFamily.bold, fontSize: 15, lineHeight: 21 },
  audioMeta: { color: Palette.textSecondary, fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 17, marginTop: 2 },
  audioUnavailable: { color: Palette.danger, fontFamily: FontFamily.bold, fontSize: 12, lineHeight: 17, marginTop: 4 },
  audioButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.lightPink },
  audioButtonPressed: { opacity: 0.7 },
  audioButtonText: { color: Palette.strongPink, fontSize: 16 },
  detailRow: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: Palette.border },
  detailLabel: { color: Palette.textSecondary, fontFamily: FontFamily.bold, fontSize: 13, lineHeight: 18 },
  detailValue: { color: Palette.text, fontFamily: FontFamily.regular, fontSize: 16, lineHeight: 23, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  actionButton: { flex: 1, minHeight: 52 },
  viewOnly: { color: Palette.textSecondary, fontFamily: FontFamily.bold, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 24 },
  deleteCard: { marginTop: 16, borderColor: '#F3CACA' },
  deleteTitle: { color: Palette.text, fontFamily: FontFamily.extraBold, fontSize: 19, lineHeight: 25 },
  deleteText: { color: Palette.textSecondary, fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 21, marginTop: 6 },
  deleteActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  error: { color: Palette.danger, fontFamily: FontFamily.bold, fontSize: 14, lineHeight: 20, marginTop: 12, textAlign: 'center' },
});
