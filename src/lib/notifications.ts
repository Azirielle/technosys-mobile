// notifications: loads expo-notifications only where it works.
// Since Expo SDK 53, Expo Go on Android no longer includes push notifications, and loading the library there
// crashes the screen that imports it. In Expo Go on Android this returns null and the app simply skips
// notifications; in the real app (APK or development build) it returns the library as usual.
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import type * as NotificationsModule from 'expo-notifications';

export type Notifications = typeof NotificationsModule;

const IN_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let cached: Notifications | null | undefined;

export function getNotifications(): Notifications | null {
  if (cached !== undefined) return cached;
  if (IN_EXPO_GO && Platform.OS === 'android') {
    cached = null;
  } else {
    // Loaded on first use, never at import time, so Expo Go on Android never touches it.
    cached = require('expo-notifications') as Notifications;
  }
  return cached;
}
