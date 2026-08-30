import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { FormField } from '@/components/form-field';
import { MeddyButton } from '@/components/meddy-button';
import { MedicinePhoto } from '@/components/medicine-photo';
import { MedicineScheduleSettings } from '@/components/medicine-schedule-settings';
import { Palette } from '@/constants/theme';
import { FontFamily } from '@/constants/typography';
import type { MedicineInput } from '@/types/medicine';

const medicineForms = ['Tablet', 'Capsule', 'Syrup', 'Drops', 'Injection', 'Other'];

const NAME_MAX_LENGTH = 80;
const DOSAGE_MAX_LENGTH = 50;
const INSTRUCTIONS_MAX_LENGTH = 200;
const NOTES_MAX_LENGTH = 500;

export const emptyMedicineInput: MedicineInput = {
  name: '',
  dosageValue: '',
  dosageUnit: '',
  form: '',
  instructions: '',
  notes: '',
  photoLocalUri: null,
  photoStoragePath: null,
  timeOfDay: '08:00',
  daysOfWeek: [1, 2, 3, 4, 5, 6, 7], // all days selected by default (effectively daily)
  mealTiming: null,
  personalizedAudioUri: null,
  personalizedAudioStoragePath: null,
  personalizedAudioDurationSeconds: null,
  personalizedAudioSource: null,
  personalizedAudioLabel: null,
  reminderSound: 'gentle_chime',
  vibrationEnabled: true,
  snoozeEnabled: true,
  snoozeMinutes: 10,
  active: true,
};

type MedicineFormProps = {
  initialValues?: MedicineInput;
  submitLabel: string;
  isSaving: boolean;
  submitError?: string;
  showActive?: boolean;
  onSubmit: (values: MedicineInput) => void;
  onCancel: () => void;
};

function validate(values: MedicineInput) {
  if (!values.name.trim()) return 'Enter the medicine name.';
  if (values.name.trim().length > NAME_MAX_LENGTH) return `Medicine name must be ${NAME_MAX_LENGTH} characters or fewer.`;
  if (!values.dosageValue.trim()) return 'Enter the dosage.';
  if (values.dosageValue.trim().length > DOSAGE_MAX_LENGTH) return `Dosage must be ${DOSAGE_MAX_LENGTH} characters or fewer.`;
  if (!values.dosageUnit.trim()) return 'Enter the dosage unit.';
  if (values.dosageUnit.trim().length > DOSAGE_MAX_LENGTH) return `Dosage unit must be ${DOSAGE_MAX_LENGTH} characters or fewer.`;
  if (!values.form) return 'Choose the medicine form.';
  if (!values.instructions.trim()) return 'Enter brief instructions.';
  if (values.instructions.trim().length > INSTRUCTIONS_MAX_LENGTH) return `Instructions must be ${INSTRUCTIONS_MAX_LENGTH} characters or fewer.`;
  if (values.notes.trim().length > NOTES_MAX_LENGTH) return `Notes must be ${NOTES_MAX_LENGTH} characters or fewer.`;
  if (!values.timeOfDay) return 'Choose a schedule time.';
  if (values.daysOfWeek.length === 0) return 'Select at least one day.';
  return null;
}

export function MedicineForm({
  initialValues = emptyMedicineInput,
  submitLabel,
  isSaving,
  submitError,
  showActive = false,
  onSubmit,
  onCancel,
}: MedicineFormProps) {
  const [values, setValues] = useState(initialValues);
  const [validationError, setValidationError] = useState('');

  function update<ValueKey extends keyof MedicineInput>(key: ValueKey, value: MedicineInput[ValueKey]) {
    setValues((current) => ({ ...current, [key]: value }));
    setValidationError('');
  }

  function submit() {
    const nextError = validate(values);
    if (nextError) {
      setValidationError(nextError);
      return;
    }
    onSubmit(values);
  }

  const error = validationError || submitError;

  return (
    <View style={styles.form}>
      <FormField
        label="Medicine Name"
        value={values.name}
        onChangeText={(value) => update('name', value)}
        placeholder="Enter medicine name"
        autoCapitalize="words"
        maxLength={NAME_MAX_LENGTH}
        returnKeyType="next"
      />
      <View style={styles.dosageRow}>
        <View style={styles.dosageValue}>
          <FormField
            label="Dosage"
            value={values.dosageValue}
            onChangeText={(value) => update('dosageValue', value)}
            placeholder="5"
            keyboardType="decimal-pad"
            maxLength={DOSAGE_MAX_LENGTH}
          />
        </View>
        <View style={styles.dosageUnit}>
          <FormField
            label="Dosage Unit"
            value={values.dosageUnit}
            onChangeText={(value) => update('dosageUnit', value)}
            placeholder="mg"
            autoCapitalize="none"
            maxLength={DOSAGE_MAX_LENGTH}
          />
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Medicine Form</Text>
        <View accessibilityRole="radiogroup" style={styles.options}>
          {medicineForms.map((form) => {
            const selected = values.form === form;
            return (
              <Pressable
                key={form}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => update('form', form)}
                style={({ pressed }) => [styles.option, selected && styles.selectedOption, pressed && styles.pressed]}>
                <Text style={[styles.optionText, selected && styles.selectedOptionText]}>{form}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FormField
        label="Instructions"
        value={values.instructions}
        onChangeText={(value) => update('instructions', value)}
        placeholder="Example: After breakfast"
        autoCapitalize="sentences"
        maxLength={INSTRUCTIONS_MAX_LENGTH}
        showCharacterCount
      />
      <FormField
        label="Optional Notes"
        value={values.notes}
        onChangeText={(value) => update('notes', value)}
        placeholder="Anything else to remember"
        autoCapitalize="sentences"
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        style={styles.notesInput}
        maxLength={NOTES_MAX_LENGTH}
        showCharacterCount
      />
      <MedicinePhoto
        value={{ localUri: values.photoLocalUri, storagePath: values.photoStoragePath }}
        onChange={(next) => {
          setValues((current) => ({ ...current, photoLocalUri: next.localUri, photoStoragePath: next.storagePath }));
          setValidationError('');
        }}
      />
      <MedicineScheduleSettings
        timeOfDay={values.timeOfDay}
        daysOfWeek={values.daysOfWeek}
        reminderSound={values.reminderSound}
        vibrationEnabled={values.vibrationEnabled}
        snoozeEnabled={values.snoozeEnabled}
        snoozeMinutes={values.snoozeMinutes}
        onTimeChange={(value) => update('timeOfDay', value)}
        onDaysOfWeekChange={(value) => update('daysOfWeek', value)}
        onSoundChange={(value) => update('reminderSound', value)}
        onVibrationChange={(value) => update('vibrationEnabled', value)}
        onSnoozeChange={(value) => update('snoozeEnabled', value)}
        onSnoozeMinutesChange={(value) => update('snoozeMinutes', value)}
        personalizedAudio={{
          uri: values.personalizedAudioUri,
          storagePath: values.personalizedAudioStoragePath,
          durationSeconds: values.personalizedAudioDurationSeconds,
          source: values.personalizedAudioSource,
          label: values.personalizedAudioLabel,
        }}
        onPersonalizedAudioChange={(value) => {
          setValues((current) => ({
            ...current,
            personalizedAudioUri: value.uri,
            personalizedAudioStoragePath: value.storagePath,
            personalizedAudioDurationSeconds: value.durationSeconds,
            personalizedAudioSource: value.source,
            personalizedAudioLabel: value.label,
          }));
        }}
      />

      {showActive ? (
        <View style={styles.activeRow}>
          <View style={styles.activeCopy}>
            <Text style={styles.activeTitle}>Active medicine</Text>
            <Text style={styles.activeText}>Include this medicine in your schedule.</Text>
          </View>
          <Switch
            accessibilityLabel="Active medicine"
            value={values.active}
            onValueChange={(value) => update('active', value)}
            trackColor={{ false: '#D9D1D3', true: Palette.primaryPink }}
            thumbColor={Palette.white}
          />
        </View>
      ) : null}

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <MeddyButton label={isSaving ? 'Saving…' : submitLabel} onPress={submit} disabled={isSaving} />
        <MeddyButton label="Cancel" onPress={onCancel} variant="secondary" style={styles.cancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 20 },
  dosageRow: { flexDirection: 'row', gap: 12 },
  dosageValue: { flex: 1 },
  dosageUnit: { flex: 1 },
  fieldGroup: { gap: 8 },
  label: { color: Palette.text, fontFamily: FontFamily.bold, fontSize: 15 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  option: { minHeight: 46, justifyContent: 'center', borderWidth: 1, borderColor: Palette.border, borderRadius: 15, backgroundColor: Palette.white, paddingHorizontal: 15 },
  selectedOption: { borderColor: Palette.strongPink, backgroundColor: Palette.softPink },
  optionText: { color: Palette.textSecondary, fontFamily: FontFamily.bold, fontSize: 15 },
  selectedOptionText: { color: Palette.strongPink },
  notesInput: { minHeight: 96, paddingTop: 15, paddingBottom: 15 },
  activeRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Palette.border, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10 },
  activeCopy: { flex: 1, paddingRight: 12 },
  activeTitle: { color: Palette.text, fontFamily: FontFamily.extraBold, fontSize: 16, lineHeight: 22 },
  activeText: { color: Palette.textSecondary, fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18, marginTop: 3 },
  error: { color: Palette.danger, fontFamily: FontFamily.bold, fontSize: 14, lineHeight: 20 },
  actions: { gap: 14, marginTop: 4 },
  cancel: { alignSelf: 'center', minWidth: 150, minHeight: 48, borderColor: 'transparent', backgroundColor: 'transparent' },
  pressed: { opacity: 0.65 },
});
