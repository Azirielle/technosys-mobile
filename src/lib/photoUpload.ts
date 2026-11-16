// Uploads a photo taken on the phone to Supabase Storage.
// React Native's fetch(uri).blob() can't be uploaded ("undefined is not a function"),
// so the file is read as bytes with expo-file-system and uploaded as an ArrayBuffer.
import { File } from 'expo-file-system';
import { supabase } from './supabase';

function contentTypeFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'heic') return 'image/heic';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

/** Uploads the file at `uri` to `bucket/path`. Throws if the upload fails. */
export async function uploadPhoto(bucket: string, path: string, uri: string): Promise<void> {
  const bytes = await new File(uri).arrayBuffer();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, { contentType: contentTypeFor(path), upsert: false });
  if (error) throw error;
}
