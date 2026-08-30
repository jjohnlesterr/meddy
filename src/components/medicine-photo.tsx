import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette } from '@/constants/theme';
import { FontFamily } from '@/constants/typography';
import { getMedicinePhotoSignedUrl } from '@/lib/medicine-photo-storage';

// Applies to the compressed output, not the original camera/gallery file —
// a large source photo is fine as long as it compresses under this cap.
const MAX_UPLOAD_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 1600;
const COMPRESS_QUALITY = 0.8;

export type MedicinePhotoValue = {
  /** Local, already-resized/compressed JPEG staged for upload. Null means no change staged this session. */
  localUri: string | null;
  /** Existing canonical Storage path, if this medicine already has a saved photo. */
  storagePath: string | null;
};

type MedicinePhotoProps = {
  value: MedicinePhotoValue;
  onChange: (value: MedicinePhotoValue) => void;
};

function isImageAsset(asset: ImagePicker.ImagePickerAsset) {
  if (asset.type && asset.type !== 'image') return false;
  if (asset.mimeType && !asset.mimeType.startsWith('image/')) return false;
  return true;
}

/** Resizes to at most MAX_DIMENSION on the longer side (never upscales) and re-encodes as compressed JPEG, so every staged photo has a consistent, deterministic format regardless of source. */
async function prepareForUpload(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const context = ImageManipulator.manipulate(asset.uri);
  const longerSide = Math.max(asset.width, asset.height);
  if (longerSide > MAX_DIMENSION) {
    if (asset.width >= asset.height) context.resize({ width: MAX_DIMENSION, height: null });
    else context.resize({ height: MAX_DIMENSION, width: null });
  }
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ compress: COMPRESS_QUALITY, format: SaveFormat.JPEG });
  return result.uri;
}

/** Returns the compressed file's size in bytes, or null if it can't be determined (in which case the size check is skipped rather than blocking an otherwise-valid photo). */
async function compressedFileSize(uri: string): Promise<number | null> {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists && typeof info.size === 'number' ? info.size : null;
}

export function MedicinePhoto({ value, onChange }: MedicinePhotoProps) {
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoadingSignedUrl, setIsLoadingSignedUrl] = useState(false);
  const requestId = useRef(0);

  function loadSignedUrl(storagePath: string) {
    const currentRequest = ++requestId.current;
    setIsLoadingSignedUrl(true);
    return getMedicinePhotoSignedUrl(storagePath)
      .then((url) => {
        if (currentRequest === requestId.current) setSignedUrl(url);
      })
      .catch(() => {
        if (currentRequest === requestId.current) setSignedUrl(null);
      })
      .finally(() => {
        if (currentRequest === requestId.current) setIsLoadingSignedUrl(false);
      });
  }

  useEffect(() => {
    // No fetch needed: a staged local photo always takes preview priority
    // over any stale signed URL (see previewUri below), and with no photo at
    // all the preview isn't rendered regardless of stale state.
    if (value.localUri || !value.storagePath) return;
    const storagePath = value.storagePath;
    // Deferred a tick so the state updates inside loadSignedUrl don't run
    // synchronously as part of this effect (matches the pattern used for
    // profile/medicine refreshes elsewhere in the app).
    const timer = setTimeout(() => void loadSignedUrl(storagePath), 0);
    return () => clearTimeout(timer);
  }, [value.localUri, value.storagePath]);

  async function handlePicked(result: ImagePicker.ImagePickerResult) {
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    if (!isImageAsset(asset)) {
      setError('This doesn’t look like a photo. Please choose an image file.');
      return;
    }

    setIsBusy(true);
    try {
      const preparedUri = await prepareForUpload(asset);
      const size = await compressedFileSize(preparedUri);
      if (size !== null && size > MAX_UPLOAD_FILE_SIZE_BYTES) {
        setError('This photo is still larger than 5 MB after compression. Please choose a smaller or simpler photo.');
        return;
      }
      setSignedUrl(null);
      onChange({ localUri: preparedUri, storagePath: value.storagePath });
    } catch (err) {
      if (__DEV__) console.warn('[Meddy] Could not process this photo.', err);
      setError('Could not use this photo. Please try a different one.');
    } finally {
      setIsBusy(false);
    }
  }

  async function takePhoto() {
    setError('');
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera permission is needed to take a photo of your medicine.');
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
      await handlePicked(result);
    } catch (err) {
      if (__DEV__) console.warn('[Meddy] Could not open the camera.', err);
      setError('Could not open the camera. Please try again.');
    }
  }

  async function chooseFromGallery() {
    setError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library permission is needed to choose a photo.');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      await handlePicked(result);
    } catch (err) {
      if (__DEV__) console.warn('[Meddy] Could not open the photo library.', err);
      setError('Could not open the photo library. Please try again.');
    }
  }

  function removePhoto() {
    setError('');
    setSignedUrl(null);
    onChange({ localUri: null, storagePath: null });
  }

  const previewUri = value.localUri ?? signedUrl;
  const hasPhoto = Boolean(value.localUri || value.storagePath);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Medicine Photo</Text>
      <Text style={styles.note}>Optional — helps you and your Care Circle recognize this medicine at a glance.</Text>

      {hasPhoto ? (
        <View style={styles.previewCard}>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.previewImage} contentFit="cover" />
          ) : (
            <View style={[styles.previewImage, styles.previewLoading]}>
              {isLoadingSignedUrl ? <ActivityIndicator color={Palette.strongPink} /> : null}
            </View>
          )}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={isBusy}
          onPress={() => void takePhoto()}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed, isBusy && styles.disabled]}>
          {isBusy ? <ActivityIndicator color={Palette.strongPink} size="small" /> : <Text style={styles.actionButtonText}>Take Photo</Text>}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={isBusy}
          onPress={() => void chooseFromGallery()}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed, isBusy && styles.disabled]}>
          <Text style={styles.actionButtonText}>Choose from Gallery</Text>
        </Pressable>
      </View>

      {hasPhoto ? (
        <Pressable accessibilityRole="button" onPress={removePhoto} style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}>
          <Text style={styles.removeButtonText}>Remove Photo</Text>
        </Pressable>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 11 },
  sectionTitle: { color: Palette.text, fontFamily: FontFamily.extraBold, fontSize: 18, lineHeight: 24 },
  note: { color: Palette.textSecondary, fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 18, marginTop: -4 },
  previewCard: { borderRadius: 18, borderWidth: 1, borderColor: Palette.border, overflow: 'hidden' },
  previewImage: { width: '100%', height: 180, backgroundColor: Palette.softPink },
  previewLoading: { alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 9 },
  actionButton: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Palette.border, borderRadius: 15, backgroundColor: Palette.white, paddingHorizontal: 10 },
  actionButtonText: { color: Palette.strongPink, fontFamily: FontFamily.bold, fontSize: 15, textAlign: 'center' },
  removeButton: { alignSelf: 'center', minHeight: 40, justifyContent: 'center', paddingHorizontal: 10 },
  removeButtonText: { color: Palette.danger, fontFamily: FontFamily.bold, fontSize: 14 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
  error: { color: Palette.danger, fontFamily: FontFamily.bold, fontSize: 13, lineHeight: 18 },
});
