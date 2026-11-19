// usePushNotifications: asks for notification permission, saves this phone's push token, and listens for
// notifications. Does nothing in Expo Go on Android, where push notifications aren't available (see lib/notifications).
import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { router, type Href } from 'expo-router';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import type { Notification } from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { getNotifications } from '../lib/notifications';
import { requestPunch } from '../lib/work/punchRequest';

let handlerSet = false;

/** How notifications show while the app is open. Set once, the first time the hook runs. */
function setForegroundHandler() {
  const Notifications = getNotifications();
  if (!Notifications || handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  // The button on the server's attendance reminders (categoryId); it opens the app straight into time in / out
  const open = { opensAppToForeground: true };
  Notifications.setNotificationCategoryAsync('time_in', [{ identifier: 'time_in', buttonTitle: 'Time in', options: open }]).catch(() => {});
  Notifications.setNotificationCategoryAsync('time_out', [{ identifier: 'time_out', buttonTitle: 'Time out', options: open }]).catch(() => {});
}

const handled = new Set<string>(); // a tap can arrive twice (live listener + the app opening from it)

/** Where a tapped push goes. Reminders (and their button) start the time-in / time-out on Home. */
function openFromPush(response: { notification: Notification; actionIdentifier: string }) {
  const id = response.notification.request.identifier;
  if (handled.has(id)) return;
  handled.add(id);
  const d = (response.notification.request.content.data ?? {}) as { jobId?: string; kind?: string; type?: string };
  if (d.kind === 'time_in_reminder' || d.kind === 'time_out_reminder') {
    router.navigate('/(tabs)' as Href);
    requestPunch(d.kind === 'time_in_reminder' ? 'in' : 'out');
  } else if (d.jobId) router.push(`/job/${d.jobId}` as Href);
  else if (d.kind === 'review' || d.kind === 'overtime' || d.kind === 'time_out') router.push('/dtr' as Href);
  else if (d.type === 'policy_acknowledgment') router.push('/handbook' as Href);
  else router.navigate('/(tabs)/inbox' as Href);
}

export function usePushNotifications(userId?: string) {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState<Notification | false>(false);
  const notificationListener = useRef<{ remove: () => void } | null>(null);
  const responseListener = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    const Notifications = getNotifications();
    if (!Notifications) return;
    setForegroundHandler();

    registerForPushNotificationsAsync().then(async (token) => {
      if (token) {
        setExpoPushToken(token);

        // Grab the authenticated user directly from Supabase
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          savePushTokenToDatabase(token, session.user.id);
        }
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener((n) => {
      setNotification(n);
    });

    // Tapping a push opens where it belongs (tags set by the admin's sendPushToUser): a job → that job, the
    // Coordinator's decisions on your day → DTR, a policy to sign → Handbook, anything else from HR / office → Inbox
    responseListener.current = Notifications.addNotificationResponseReceivedListener(openFromPush);
    // The app was closed and a push opened it: that tap doesn't reach the listener above
    Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r && Date.now() - r.notification.date < 10 * 60_000) openFromPush(r);
      if (r) Notifications.clearLastNotificationResponseAsync?.().catch(() => {}); // so the next app start doesn't repeat it
    }).catch(() => {});

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [userId]);

  const savePushTokenToDatabase = async (token: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('push_tokens')
        .upsert({
          user_id: userId,
          token: token,
          platform: Platform.OS
        }, {
          onConflict: 'token'
        });

      if (error && error.code !== '42P01') {
        console.warn('Error saving push token', error);
      }
    } catch (e) {
      console.warn('Failed to save push token', e);
    }
  };

  return { expoPushToken, notification };
}

async function registerForPushNotificationsAsync() {
  const Notifications = getNotifications();
  if (!Notifications) return;
  let token;

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return;
    }

    token = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });
  } else {
    console.warn('Must use physical device for Push Notifications');
  }

  return token?.data;
}
