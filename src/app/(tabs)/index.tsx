// Home tab: the shared parts (push sign-up, sending what was saved offline) around one of two homes:
// ClassicHome (today's time-in) or WorkHome (Work v2), picked by WORK_V2 in lib/work/workApi.ts.
// Everything else opens as its own full screen (Techy's chat is app/assistant.tsx).
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { syncQueue } from '../../lib/syncQueue';
import { useFocusRefresh } from '../../lib/useFocusRefresh';
import { WORK_V2 } from '../../lib/work/workApi';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import ClassicHome from '../../components/home/ClassicHome';
import WorkHome from '../../components/work/WorkHome';
import { GlowScreen } from '../../ui';

export default function HomeScreen() {
  usePushNotifications(); // registers this phone for push notifications

  // Time-ins and time-outs saved on the phone without signal are sent when Home opens or comes back
  useFocusRefresh(() => { syncQueue.syncPendingQueue().catch(() => {}); });

  return (
    <GlowScreen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {WORK_V2 ? <WorkHome /> : <ClassicHome />}
      </SafeAreaView>
    </GlowScreen>
  );
}
