import { useState } from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Palette } from '@/constants/theme';
import { FontFamily } from '@/constants/typography';

const ITEM_HEIGHT = 52;
const VISIBLE_ITEMS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const WHEEL_PADDING = ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2);

const hours = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));
const periods = ['AM', 'PM'] as const;

type Period = (typeof periods)[number];

type TimeParts = {
  hour: string;
  minute: string;
  period: Period;
};

type MeddyTimePickerModalProps = {
  value: string;
  onCancel: () => void;
  onDone: (value: string) => void;
};

function clampIndex(index: number, length: number) {
  return Math.max(0, Math.min(length - 1, index));
}

function partsFromDatabaseTime(value: string): TimeParts {
  const [rawHour = '08', rawMinute = '00'] = value.split(':');
  const hour24 = Number(rawHour);
  const minute = Number(rawMinute);
  const validHour = Number.isInteger(hour24) && hour24 >= 0 && hour24 <= 23 ? hour24 : 8;
  const validMinute = Number.isInteger(minute) && minute >= 0 && minute <= 59 ? minute : 0;

  return {
    hour: String(validHour % 12 || 12).padStart(2, '0'),
    minute: String(validMinute).padStart(2, '0'),
    period: validHour >= 12 ? 'PM' : 'AM',
  };
}

function databaseTimeFromParts({ hour, minute, period }: TimeParts) {
  const hour12 = Number(hour);
  const hour24 = period === 'AM' ? hour12 % 12 : (hour12 % 12) + 12;
  return `${String(hour24).padStart(2, '0')}:${minute}`;
}

export function formatFriendlyTime(value: string) {
  const parts = partsFromDatabaseTime(value);
  return `${Number(parts.hour)}:${parts.minute} ${parts.period}`;
}

export function parseFriendlyTime(value: string) {
  const match = value.match(/^\s*(0?[1-9]|1[0-2]):([0-5]\d)\s*([AaPp][Mm])\s*$/);
  if (!match) return null;

  return databaseTimeFromParts({
    hour: match[1].padStart(2, '0'),
    minute: match[2],
    period: match[3].toUpperCase() as Period,
  });
}

type TimeWheelProps = {
  accessibilityLabel: string;
  values: readonly string[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  width: number;
};

function TimeWheel({ accessibilityLabel, values, selectedValue, onValueChange, width }: TimeWheelProps) {
  const selectedIndex = Math.max(0, values.indexOf(selectedValue));

  return (
    <FlatList
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="adjustable"
      contentContainerStyle={styles.wheelContent}
      data={values}
      decelerationRate="fast"
      getItemLayout={(_data, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
      initialScrollIndex={selectedIndex}
      keyExtractor={(item) => item}
      onMomentumScrollEnd={(event) => {
        const index = clampIndex(Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT), values.length);
        onValueChange(values[index]);
      }}
      renderItem={({ item }) => {
        const selected = item === selectedValue;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onValueChange(item)}
            style={[styles.wheelItem, { width }]}>
            <Text style={[styles.wheelText, selected && styles.selectedWheelText]}>{item}</Text>
          </Pressable>
        );
      }}
      showsVerticalScrollIndicator={false}
      snapToAlignment="start"
      snapToInterval={ITEM_HEIGHT}
      style={[styles.wheel, { width }]}
    />
  );
}

export function MeddyTimePickerModal({ value, onCancel, onDone }: MeddyTimePickerModalProps) {
  const initialParts = partsFromDatabaseTime(value);
  const [parts, setParts] = useState(initialParts);
  const [manualMode, setManualMode] = useState(false);
  const [manualValue, setManualValue] = useState(formatFriendlyTime(value));
  const [manualError, setManualError] = useState('');

  function finish() {
    Keyboard.dismiss();
    if (!manualMode) {
      onDone(databaseTimeFromParts(parts));
      return;
    }

    const parsed = parseFriendlyTime(manualValue);
    if (!parsed) {
      setManualError('Enter a time like 8:00 AM.');
      return;
    }
    onDone(parsed);
  }

  function showManualEntry() {
    setManualValue(formatFriendlyTime(databaseTimeFromParts(parts)));
    setManualError('');
    setManualMode(true);
  }

  function showWheels() {
    const parsed = parseFriendlyTime(manualValue);
    if (parsed) setParts(partsFromDatabaseTime(parsed));
    setManualError('');
    Keyboard.dismiss();
    setManualMode(false);
  }

  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalScreen}>
        <Pressable accessibilityLabel="Close time picker" onPress={onCancel} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={styles.modalCard}>
          <Text style={styles.modalTitle}>Choose a time</Text>

          {manualMode ? (
            <View style={styles.manualSection}>
              <Text style={styles.inputLabel}>Time</Text>
              <TextInput
                accessibilityLabel="Type reminder time"
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                keyboardType="default"
                onChangeText={(nextValue) => {
                  setManualValue(nextValue);
                  setManualError('');
                }}
                onSubmitEditing={finish}
                placeholder="8:00 AM"
                placeholderTextColor={Palette.textSecondary}
                returnKeyType="done"
                selectTextOnFocus
                style={[styles.manualInput, manualError && styles.manualInputError]}
                value={manualValue}
              />
              {manualError ? <Text accessibilityRole="alert" style={styles.errorText}>{manualError}</Text> : null}
              <Pressable accessibilityRole="button" onPress={showWheels} style={({ pressed }) => [styles.modeButton, pressed && styles.pressed]}>
                <Text style={styles.modeButtonText}>Use time wheels</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.wheelPicker}>
                <View pointerEvents="none" style={styles.selectionBand} />
                <TimeWheel
                  accessibilityLabel="Hour"
                  values={hours}
                  selectedValue={parts.hour}
                  onValueChange={(hour) => setParts((current) => ({ ...current, hour }))}
                  width={76}
                />
                <Text pointerEvents="none" style={styles.colon}>:</Text>
                <TimeWheel
                  accessibilityLabel="Minute"
                  values={minutes}
                  selectedValue={parts.minute}
                  onValueChange={(minute) => setParts((current) => ({ ...current, minute }))}
                  width={76}
                />
                <TimeWheel
                  accessibilityLabel="AM or PM"
                  values={periods}
                  selectedValue={parts.period}
                  onValueChange={(period) => setParts((current) => ({ ...current, period: period as Period }))}
                  width={82}
                />
              </View>
              <Pressable accessibilityRole="button" onPress={showManualEntry} style={({ pressed }) => [styles.modeButton, pressed && styles.pressed]}>
                <Text style={styles.modeButtonText}>Type time instead</Text>
              </Pressable>
            </>
          )}

          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={onCancel} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={finish} style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalScreen: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(43, 43, 43, 0.3)', padding: 20 },
  modalCard: { alignSelf: 'center', width: '100%', maxWidth: 430, borderRadius: 26, backgroundColor: Palette.white, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 18 },
  modalTitle: { color: Palette.text, fontFamily: FontFamily.extraBold, fontSize: 22, lineHeight: 28, textAlign: 'center' },
  wheelPicker: { height: WHEEL_HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, overflow: 'hidden' },
  wheel: { height: WHEEL_HEIGHT, flexGrow: 0 },
  wheelContent: { paddingVertical: WHEEL_PADDING },
  wheelItem: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  wheelText: { color: Palette.textSecondary, fontFamily: FontFamily.bold, fontSize: 20, lineHeight: 28, opacity: 0.38 },
  selectedWheelText: { color: Palette.text, fontFamily: FontFamily.extraBold, fontSize: 29, lineHeight: 36, opacity: 1 },
  selectionBand: { position: 'absolute', left: 8, right: 8, top: WHEEL_PADDING, height: ITEM_HEIGHT, borderWidth: 1, borderColor: Palette.border, borderRadius: 16, backgroundColor: Palette.softPink },
  colon: { zIndex: 1, width: 22, color: Palette.text, fontFamily: FontFamily.extraBold, fontSize: 29, lineHeight: 36, textAlign: 'center' },
  modeButton: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, marginTop: 4 },
  modeButtonText: { color: Palette.strongPink, fontFamily: FontFamily.extraBold, fontSize: 15, lineHeight: 20 },
  manualSection: { gap: 8, paddingTop: 24, paddingBottom: 14 },
  inputLabel: { color: Palette.text, fontFamily: FontFamily.extraBold, fontSize: 15, lineHeight: 20 },
  manualInput: { minHeight: 58, borderWidth: 1, borderColor: Palette.border, borderRadius: 17, backgroundColor: Palette.white, color: Palette.text, fontFamily: FontFamily.bold, fontSize: 22, lineHeight: 28, textAlign: 'center', paddingHorizontal: 16 },
  manualInputError: { borderColor: Palette.danger },
  errorText: { color: Palette.danger, fontFamily: FontFamily.bold, fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 18, borderTopWidth: 1, borderTopColor: Palette.border, paddingTop: 16, marginTop: 10 },
  cancelButton: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  cancelText: { color: Palette.textSecondary, fontFamily: FontFamily.extraBold, fontSize: 16, lineHeight: 22 },
  doneButton: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: Palette.strongPink },
  doneText: { color: Palette.white, fontFamily: FontFamily.extraBold, fontSize: 16, lineHeight: 22 },
  pressed: { opacity: 0.68 },
});
