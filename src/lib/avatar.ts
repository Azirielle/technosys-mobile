// Profile photo: pick or take a picture, upload it to the public "avatars" bucket, save the link on the profile.
// People may change their own photo (the profile guard blocks role and 201 fields, not the photo).
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';
import { uploadPhoto } from './photoUpload';

export type AvatarResult = { ok: true; url: string } | { ok: false; reason: 'cancelled' | 'permission' | 'failed' };

export async function changeAvatar(source: 'camera' | 'library'): Promise<AvatarResult> {
  // Gallery = Android's photo picker, which needs no permission (Google Play allows no broad photo access here)
  const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : { granted: true };
  if (!perm.granted) return { ok: false, reason: 'permission' };
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 };
  const picked = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (picked.canceled || !picked.assets[0]?.uri) return { ok: false, reason: 'cancelled' };

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, reason: 'failed' };
    const path = `${user.id}/avatar-${Date.now()}.jpg`;
    await uploadPhoto('avatars', path, picked.assets[0].uri);
    const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
    if (error) return { ok: false, reason: 'failed' };
    return { ok: true, url };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
