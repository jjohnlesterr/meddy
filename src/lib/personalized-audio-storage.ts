import { supabase, supabaseConfigurationError } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Cross-device storage for personalized reminder audio (recorded or picked).
// Backed by the private `personalized-reminder-audio` Supabase Storage bucket
// — see supabase/medicine_personalized_audio_storage.sql for the bucket and
// RLS policies (NOT YET APPLIED; pending review). Objects are stored under
// `{ownerUserId}/{randomId}.{ext}`; RLS grants read access to the owner and to
// Care Circle members of the medicine the recording is attached to (matched
// by exact stored path, not by parsing the path), and restricts
// insert/update/delete to the owner-prefixed folder only.
//
// This module never makes the bucket or its objects public, and never returns
// a permanent public URL — only short-lived signed URLs, which only succeed
// for a caller RLS actually authorizes.
// ---------------------------------------------------------------------------

const BUCKET = 'personalized-reminder-audio';

function getSupabase() {
  if (!supabase) throw new Error(supabaseConfigurationError ?? 'Supabase is not configured.');
  return supabase;
}

function randomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function extensionFromUri(uri: string, fallback = 'm4a') {
  const match = /\.([a-zA-Z0-9]+)(?:\?|#|$)/.exec(uri);
  return match ? match[1].toLowerCase() : fallback;
}

/**
 * Uploads a local audio file to the current user's own folder in the private
 * bucket, returning the object path to persist on the medicine schedule
 * (`personalized_audio_storage_path`). This is the canonical, cross-device
 * value — a local file URI alone is never sufficient for Care Circle sharing.
 */
export async function uploadPersonalizedAudio(userId: string, localUri: string, contentType = 'audio/m4a'): Promise<string> {
  const client = getSupabase();
  const path = `${userId}/${randomId()}.${extensionFromUri(localUri)}`;

  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await client.storage.from(BUCKET).upload(path, arrayBuffer, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

/** Removes a previously uploaded personalized-audio object. Never throws — a failed cleanup must not block the surrounding save/delete flow. */
export async function deletePersonalizedAudio(path: string | null | undefined) {
  if (!path || !supabase) return;
  try {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error && __DEV__) console.warn('[Meddy personalized audio] Could not delete storage object.', error);
  } catch (error) {
    if (__DEV__) console.warn('[Meddy personalized audio] Could not delete storage object.', error);
  }
}

/**
 * Returns a short-lived signed URL for playing/downloading a personalized
 * audio object. RLS on storage.objects governs who this succeeds for — the
 * owner, or an authenticated Care Circle member of the shared medicine the
 * recording is attached to. Throws if the caller isn't authorized or the
 * object doesn't exist; callers should treat that as "unavailable", not crash.
 */
export async function getPersonalizedAudioSignedUrl(path: string, expiresInSeconds = 300): Promise<string> {
  const client = getSupabase();
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) throw error ?? new Error('Could not create a link for this audio.');
  return data.signedUrl;
}
