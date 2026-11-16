// Phone permissions the app needs: location (time-in check), camera (selfie) and notifications.
// Only "while using the app" location is asked: there is no background tracking.
import { Linking } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { getNotifications } from './notifications';

export type PermissionName = 'location' | 'camera' | 'notifications';
/** unavailable = this build can't use it (notifications in Expo Go on Android) */
export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable';
export type PermissionStates = Record<PermissionName, PermissionState>;

function stateOf(p: { granted: boolean; status: string }): PermissionState {
  if (p.granted) return 'granted';
  return p.status === 'undetermined' ? 'undetermined' : 'denied';
}

export async function getPermissionStates(): Promise<PermissionStates> {
  const notifications = getNotifications();
  const [location, camera, notif] = await Promise.all([
    Location.getForegroundPermissionsAsync().catch(() => null),
    ImagePicker.getCameraPermissionsAsync().catch(() => null),
    notifications ? notifications.getPermissionsAsync().catch(() => null) : Promise.resolve(null),
  ]);
  return {
    location: location ? stateOf(location) : 'undetermined',
    camera: camera ? stateOf(camera) : 'undetermined',
    notifications: !notifications ? 'unavailable' : notif ? stateOf(notif) : 'undetermined',
  };
}

/** Asks Android for each permission not yet allowed, one after the other. Returns the new states. */
export async function requestMissingPermissions(): Promise<PermissionStates> {
  const before = await getPermissionStates();
  if (before.location !== 'granted') await Location.requestForegroundPermissionsAsync().catch(() => null);
  if (before.camera !== 'granted') await ImagePicker.requestCameraPermissionsAsync().catch(() => null);
  const notifications = getNotifications();
  if (notifications && before.notifications !== 'granted') await notifications.requestPermissionsAsync().catch(() => null);
  return getPermissionStates();
}

/** When Android won't ask again ("Don't allow" twice), the only way is the phone's settings. */
export function openPhoneSettings() {
  Linking.openSettings().catch(() => {});
}
