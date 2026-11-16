// This phone's id for the "one registered phone" rule. A random id is made once and kept in the
// phone's secure storage (Android Keystore / iOS Keychain), so it can't be copied to another phone.
// Uninstalling the app makes a new id: the technician then asks HR to approve the "new" phone.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';

const KEY = 'technosys_phone_id';
let cached: string | null = null;

async function read(): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(KEY);
  return SecureStore.getItemAsync(KEY);
}

async function write(value: string): Promise<void> {
  if (Platform.OS === 'web') return AsyncStorage.setItem(KEY, value);
  return SecureStore.setItemAsync(KEY, value);
}

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  let id = await read();
  if (!id) {
    id = `phone-${Crypto.randomUUID()}`;
    await write(id);
  }
  cached = id;
  return id;
}

/** A name HR recognises in the 201 file, e.g. "Samsung SM-A155F". */
export function getDeviceName(): string {
  const name = [Device.manufacturer, Device.modelName].filter(Boolean).join(' ');
  return name || 'Phone';
}
