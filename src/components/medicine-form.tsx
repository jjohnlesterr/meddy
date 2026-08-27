import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { FormField } from '@/components/form-field';
import { MeddyButton } from '@/components/meddy-button';
import { MedicineScheduleSettings } from '@/components/medicine-schedule-settings';
import { Palette } from '@/constants/theme';
import type { MedicineInput } from '@/types/medicine';

const medicineForms = ['Tablet', 'Capsule', 'Syrup', 'Drops', 'Injection', 'Other'];

export const emptyMedicineInput: MedicineInput = {
  name: '',
  dosageValue: '',
  dosageUnit: '',
  form: '',
  instructions: '',
  notes: '',
  timeOfDay: '08:00',
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
  if (!values.dosageValue.trim()) return 'Enter the dosage.';
  if (!values.dosageUnit.trim()) return 'Enter the dosage unit.';
  if (!values.form) return 'Choose the medicine form.';
  if (!values.instructions.trim()) return 'Enter brief instructions.';
  if (!values.timeOfDay) return 'Choose a schedule time.';
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
          />
        </View>
        <View style={styles.dosageUnit}>
          <FormField
            label="Dosage Unit"
            value={values.dosageUnit}
            onChangeText={(value) => update('dosageUnit', value)}
            placeholder="mg"
            autoCapitalize="none"
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
      />
      <MedicineScheduleSettings
        timeOfDay={values.timeOfDay}
        reminderSound={values.reminderSound}
        vibrationEnabled={values.vibrationEnabled}
        snoozeEnabled={values.snoozeEnabled}
        snoozeMinutes={values.snoozeMinutes}
        onTimeChange={(value) => update('timeOfDay', value)}
        onSoundChange={(value) => update('reminderSound', value)}
        onVibrationChange={(value) => update('vibrationEnabled', value)}
        onSnoozeChange={(value) => update('snoozeEnabled', value)}
        onSnoozeMinutesChange={(value) => update('snoozeMinutes', value)}
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
  label: { color: Palette.text, fontSize: 15, fontWeight: '700' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  option: { minHeight: 46, justifyContent: 'center', borderWidth: 1, borderColor: Palette.border, borderRadius: 15, backgroundColor: Palette.white, paddingHorizontal: 15 },
  selectedOption: { borderColor: Palette.strongPink, backgroundColor: Palette.softPink },
  optionText: { color: Palette.textSecondary, fontSize: 15, fontWeight: '700' },
  selectedOptionText: { color: Palette.strongPink },
  notesInput: { minHeight: 96, paddingTop: 15, paddingBottom: 15 },
  activeRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Palette.border, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10 },
  activeCopy: { flex: 1, paddingRight: 12 },
  activeTitle: { color: Palette.text, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  activeText: { color: Palette.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 3 },
  error: { color: Palette.danger, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  actions: { gap: 14, marginTop: 4 },
  cancel: { alignSelf: 'center', minWidth: 150, minHeight: 48, borderColor: 'transparent', backgroundColor: 'transparent' },
  pressed: { opacity: 0.65 },
});
