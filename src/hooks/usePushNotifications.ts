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
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const d = (response.notification.request.content.data ?? {}) as { jobId?: string; kind?: string; type?: string };
      if (d.jobId) router.push(`/job/${d.jobId}` as Href);
      else if (d.kind === 'review' || d.kind === 'overtime' || d.kind === 'time_out') router.push('/dtr' as Href);
      else if (d.type === 'policy_acknowledgment') router.push('/handbook' as Href);
      else router.navigate('/(tabs)/inbox' as Href);
    });

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
