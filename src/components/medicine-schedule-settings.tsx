import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { MeddyTimePickerModal, formatFriendlyTime } from '@/components/meddy-time-picker-modal';
import { reminderSoundPreviewSources } from '@/constants/reminder-sound-previews';
import { Palette } from '@/constants/theme';
import type { ReminderSound, SnoozeMinutes } from '@/types/medicine';

const reminderSounds: { id: ReminderSound; label: string }[] = [
  { id: 'gentle_chime', label: 'Gentle Chime' },
  { id: 'soft_bell', label: 'Soft Bell' },
  { id: 'morning_tone', label: 'Morning Tone' },
];

const snoozeOptions: SnoozeMinutes[] = [5, 10, 15];
const MAX_PREVIEW_MILLISECONDS = 5_000;
// True only once the three MP3s exist under assets/sounds and are wired into
// reminderSoundPreviewSources. Until then the in-app preview is silent and the
// actual reminder uses the Android system default notification sound.
const soundPreviewsAvailable = Object.keys(reminderSoundPreviewSources).length > 0;

type ActiveSoundPreview = {
  player: AudioPlayer;
  timer: ReturnType<typeof setTimeout> | null;
  released: boolean;
};

type MedicineScheduleSettingsProps = {
  timeOfDay: string;
  reminderSound: ReminderSound;
  vibrationEnabled: boolean;
  snoozeEnabled: boolean;
  snoozeMinutes: SnoozeMinutes;
  onTimeChange: (value: string) => void;
  onSoundChange: (value: ReminderSound) => void;
  onVibrationChange: (value: boolean) => void;
  onSnoozeChange: (value: boolean) => void;
  onSnoozeMinutesChange: (value: SnoozeMinutes) => void;
};

export function MedicineScheduleSettings({
  timeOfDay,
  reminderSound,
  vibrationEnabled,
  snoozeEnabled,
  snoozeMinutes,
  onTimeChange,
  onSoundChange,
  onVibrationChange,
  onSnoozeChange,
  onSnoozeMinutesChange,
}: MedicineScheduleSettingsProps) {
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showSoundPicker, setShowSoundPicker] = useState(false);
  const activePreview = useRef<ActiveSoundPreview | null>(null);
  const previewSequence = useRef(0);
  const mounted = useRef(true);
  const selectedSound = reminderSounds.find((sound) => sound.id === reminderSound) ?? reminderSounds[0];

  const releasePreview = useCallback((preview: ActiveSoundPreview | null) => {
    if (!preview || preview.released) return;

    preview.released = true;
    if (preview.timer) {
      clearTimeout(preview.timer);
      preview.timer = null;
    }
    if (activePreview.current === preview) activePreview.current = null;

    try {
      preview.player.release();
    } catch (error) {
      if (__DEV__) console.warn('Could not release reminder sound preview.', error);
    }
  }, []);

  const stopSoundPreview = useCallback(() => {
    previewSequence.current += 1;
    releasePreview(activePreview.current);
  }, [releasePreview]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopSoundPreview();
    };
  }, [stopSoundPreview]);

  async function previewSound(sound: ReminderSound) {
    stopSoundPreview();
    const source = reminderSoundPreviewSources[sound];
    if (!source) return;

    const sequence = previewSequence.current;
    let preview: ActiveSoundPreview | null = null;
    try {
      await setAudioModeAsync({ playsInSilentMode: true });
      if (!mounted.current || sequence !== previewSequence.current) return;

      preview = {
        player: createAudioPlayer(source),
        timer: null,
        released: false,
      };
      activePreview.current = preview;
      preview.player.play();
      preview.timer = setTimeout(() => releasePreview(preview), MAX_PREVIEW_MILLISECONDS);
    } catch (error) {
      releasePreview(preview);
      if (__DEV__) console.warn('Could not preview reminder sound.', error);
    }
  }

  function openTimePicker() {
    Keyboard.dismiss();
    setShowTimePicker(true);
  }

  function closeSoundPicker() {
    stopSoundPreview();
    setShowSoundPicker(false);
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Schedule</Text>
      <View style={styles.card}>
        <Pressable
          accessibilityLabel={`Time, ${formatFriendlyTime(timeOfDay)}`}
          accessibilityRole="button"
          onPress={openTimePicker}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <Text style={styles.rowLabel}>Time</Text>
          <View style={styles.rowValueGroup}>
            <Text style={styles.rowValue}>{formatFriendlyTime(timeOfDay)}</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Reminder Settings</Text>
      <View style={styles.card}>
        <Pressable
          accessibilityLabel={`Reminder Sound, ${selectedSound.label}`}
          accessibilityRole="button"
          onPress={() => setShowSoundPicker(true)}
          style={({ pressed }) => [styles.row, styles.divider, pressed && styles.pressed]}>
          <Text style={styles.rowLabel}>Sound</Text>
          <View style={styles.rowValueGroup}>
            <Text style={styles.rowValue}>{selectedSound.label}</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Pressable>

        <View style={[styles.row, styles.divider]}>
          <Text style={styles.rowLabel}>Vibration</Text>
          <Switch
            accessibilityLabel="Vibration"
            value={vibrationEnabled}
            onValueChange={onVibrationChange}
            trackColor={{ false: '#D9D1D3', true: Palette.primaryPink }}
            thumbColor={Palette.white}
          />
        </View>

        <View style={snoozeEnabled ? [styles.row, styles.divider] : styles.row}>
          <Text style={styles.rowLabel}>Snooze</Text>
          <Switch
            accessibilityLabel="Snooze"
            value={snoozeEnabled}
            onValueChange={onSnoozeChange}
            trackColor={{ false: '#D9D1D3', true: Palette.primaryPink }}
            thumbColor={Palette.white}
          />
        </View>

        {snoozeEnabled ? (
          <View style={styles.snoozeSection}>
            <Text style={styles.snoozeLabel}>Snooze for</Text>
            <View style={styles.snoozeOptions}>
              {snoozeOptions.map((minutes) => {
                const selected = snoozeMinutes === minutes;
                return (
                  <Pressable
                    key={minutes}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => onSnoozeMinutesChange(minutes)}
                    style={({ pressed }) => [styles.snoozeOption, selected && styles.selectedOption, pressed && styles.pressed]}>
                    <Text style={[styles.snoozeOptionText, selected && styles.selectedOptionText]}>{minutes} min</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>

      {showTimePicker ? (
        <MeddyTimePickerModal
          value={timeOfDay}
          onCancel={() => setShowTimePicker(false)}
          onDone={(value) => {
            onTimeChange(value);
            setShowTimePicker(false);
          }}
        />
      ) : null}

      <Modal animationType="fade" onRequestClose={closeSoundPicker} transparent visible={showSoundPicker}>
        <View style={styles.modalScreen}>
          <Pressable accessibilityLabel="Close sound picker" onPress={closeSoundPicker} style={StyleSheet.absoluteFill} />
          <View accessibilityViewIsModal style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reminder Sound</Text>
            {!soundPreviewsAvailable ? (
              <Text style={styles.previewNote}>
                Reminders play your device’s default notification sound. In-app previews arrive once custom sounds
                are added.
              </Text>
            ) : null}
            {reminderSounds.map((sound) => {
              const selected = reminderSound === sound.id;
              return (
                <Pressable
                  key={sound.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => {
                    onSoundChange(sound.id);
                    void previewSound(sound.id);
                  }}
                  style={({ pressed }) => [styles.soundOption, selected && styles.selectedSound, pressed && styles.pressed]}>
                  <Text style={[styles.radio, selected && styles.selectedSoundText]}>{selected ? '●' : '○'}</Text>
                  <Text style={[styles.soundText, selected && styles.selectedSoundText]}>{sound.label}</Text>
                </Pressable>
              );
            })}
            <Pressable accessibilityRole="button" onPress={closeSoundPicker} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
              <Text style={styles.closeText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 11 },
  sectionTitle: { color: Palette.text, fontSize: 18, lineHeight: 24, fontWeight: '800', marginTop: 5 },
  card: { borderWidth: 1, borderColor: Palette.border, borderRadius: 20, backgroundColor: Palette.white, overflow: 'hidden' },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingHorizontal: 16 },
  divider: { borderBottomWidth: 1, borderBottomColor: Palette.border },
  rowLabel: { flexShrink: 1, color: Palette.text, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  rowValueGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 9 },
  rowValue: { flexShrink: 1, color: Palette.textSecondary, fontSize: 16, lineHeight: 22, textAlign: 'right' },
  chevron: { color: Palette.strongPink, fontSize: 26, lineHeight: 28 },
  snoozeSection: { borderTopWidth: 1, borderTopColor: Palette.border, backgroundColor: Palette.softPink, padding: 16 },
  snoozeLabel: { color: Palette.text, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  snoozeOptions: { flexDirection: 'row', gap: 9, marginTop: 11 },
  snoozeOption: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Palette.border, borderRadius: 14, backgroundColor: Palette.white, paddingHorizontal: 8 },
  selectedOption: { borderColor: Palette.strongPink, backgroundColor: Palette.lightPink },
  snoozeOptionText: { color: Palette.textSecondary, fontSize: 14, fontWeight: '800' },
  selectedOptionText: { color: Palette.strongPink },
  modalScreen: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(43, 43, 43, 0.3)', padding: 22 },
  modalCard: { alignSelf: 'center', width: '100%', maxWidth: 440, borderRadius: 24, backgroundColor: Palette.white, padding: 20 },
  modalTitle: { color: Palette.text, fontSize: 21, lineHeight: 27, fontWeight: '800', marginBottom: 12 },
  previewNote: { color: Palette.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 10 },
  soundOption: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingHorizontal: 14 },
  selectedSound: { backgroundColor: Palette.softPink },
  soundText: { flex: 1, color: Palette.text, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  selectedSoundText: { color: Palette.strongPink },
  radio: { width: 24, color: Palette.textSecondary, fontSize: 21, textAlign: 'center' },
  closeButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: Palette.strongPink, marginTop: 14 },
  closeText: { color: Palette.white, fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.65 },
});
