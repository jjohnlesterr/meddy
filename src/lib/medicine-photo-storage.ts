import { supabase, supabaseConfigurationError } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Cross-device storage for medicine photos. Backed by the private
// `medicine-photos` Supabase Storage bucket — see
// supabase/medicine_photos.sql for the bucket and RLS policies (NOT YET
// APPLIED; pending review). Objects are stored at the deterministic path
// `{medicineId}/photo.jpg` — every upload is normalized to JPEG first, so a
// replacement is just an overwrite (upload with upsert: true) and there is
// never an orphaned previous object to separately clean up.
//
// This module never makes the bucket or its objects public, and never
// returns a permanent public URL — only short-lived signed URLs, which only
// succeed for a caller RLS actually authorizes.
// ---------------------------------------------------------------------------

const BUCKET = 'medicine-photos';

function getSupabase() {
  if (!supabase) throw new Error(supabaseConfigurationError ?? 'Supabase is not configured.');
  return supabase;
}

function photoPath(medicineId: string) {
  return `${medicineId}/photo.jpg`;
}

/**
 * Uploads a (already resized/compressed) local JPEG to the deterministic
 * path for this medicine, overwriting any previous photo in place. Returns
 * the object path to persist on the medicine record (`photo_storage_path`).
 */
export async function uploadMedicinePhoto(medicineId: string, localUri: string): Promise<string> {
  const client = getSupabase();
  const path = photoPath(medicineId);

  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await client.storage.from(BUCKET).upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return path;
}

/** Removes this medicine's photo object, if any. Never throws — a failed cleanup must not block the surrounding save/delete flow. */
export async function deleteMedicinePhoto(medicineId: string) {
  if (!supabase) return;
  try {
    const { error } = await supabase.storage.from(BUCKET).remove([photoPath(medicineId)]);
    if (error && __DEV__) console.warn('[Meddy medicine photo] Could not delete storage object.', error);
  } catch (error) {
    if (__DEV__) console.warn('[Meddy medicine photo] Could not delete storage object.', error);
  }
}

/**
 * Returns a short-lived signed URL for viewing a medicine photo. RLS on
 * storage.objects governs who this succeeds for — the medicine's owner, or
 * an authenticated Care Circle member of the shared medicine. Throws if the
 * caller isn't authorized or the object doesn't exist; callers should treat
 * that as "unavailable", not crash.
 */
export async function getMedicinePhotoSignedUrl(path: string, expiresInSeconds = 300): Promise<string> {
  const client = getSupabase();
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) throw error ?? new Error('Could not create a link for this photo.');
  return data.signedUrl;
}
