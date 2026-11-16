// This phone's id for the "one registered phone" rule.
// It comes from the id the phone itself gives this app (Android ID / iOS vendor id), so it stays the
// same after "Clear data" or reinstalling the app. Only a one-way scrambled copy (SHA-256) leaves the
// phone, so the office can't use it to look up anything else about the phone.
// It changes only after a factory reset, or when moving from Expo Go to the real app (a different app):
// then the technician asks HR to approve the "new" phone.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';

const FALLBACK_KEY = 'technosys_phone_id';
let cached: string | null = null;

/** The phone's own id for this app, or null if it has none (web, rare phones). */
async function phoneOwnId(): Promise<string | null> {
  try {
    if (Platform.OS === 'android') return Application.getAndroidId() || null;
    if (Platform.OS === 'ios') return (await Application.getIosIdForVendorAsync()) || null;
  } catch {
    // fall through to the saved id
  }
  return null;
}

/** Only when the phone gives no id: a random id saved by the app. */
async function savedRandomId(): Promise<string> {
  let id = await AsyncStorage.getItem(FALLBACK_KEY);
  if (!id) {
    id = Crypto.randomUUID();
    await AsyncStorage.setItem(FALLBACK_KEY, id);
  }
  return id;
}

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  const raw = (await phoneOwnId()) ?? (await savedRandomId());
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `technosys:${raw}`);
  cached = `${Platform.OS}-${hash}`;
  return cached;
}

/** A name HR recognises on the Work phones page, e.g. "Samsung SM-A155F". */
export function getDeviceName(): string {
  const name = [Device.manufacturer, Device.modelName].filter(Boolean).join(' ');
  return name || 'Phone';
}
