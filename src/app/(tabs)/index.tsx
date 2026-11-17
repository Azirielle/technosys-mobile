// Home tab: the shared parts (push sign-up, sending what was saved offline, the Support chat pop-up that Techy
// and the Inbox open) around one of two homes: ClassicHome (today's time-in) or WorkHome (Work v2), picked by
// WORK_V2 in lib/work/workApi.ts. Everything else opens as its own full screen.
import React, { useEffect, useState } from 'react';
import RNModal from 'react-native-modal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { syncQueue } from '../../lib/syncQueue';
import { onHomeAction } from '../../lib/homeActions';
import { useFocusRefresh } from '../../lib/useFocusRefresh';
import { WORK_V2 } from '../../lib/work/workApi';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import SupportChatUI from '../../components/SupportChatUI';
import ClassicHome from '../../components/home/ClassicHome';
import WorkHome from '../../components/work/WorkHome';
import { GlowScreen } from '../../ui';

export default function HomeScreen() {
  usePushNotifications(); // registers this phone for push notifications
  const [support, setSupport] = useState<{ open: boolean; ticketId?: string }>({ open: false });

  // Time-ins and time-outs saved on the phone without signal are sent when Home opens or comes back
  useFocusRefresh(() => { syncQueue.syncPendingQueue().catch(() => {}); });

  useEffect(() => onHomeAction((action) => {
    if (action.kind === 'support') setSupport({ open: true, ticketId: action.ticketId });
  }), []);

  return (
    <GlowScreen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {WORK_V2 ? <WorkHome /> : <ClassicHome />}

        {/* Support chat (the AI assistant and your tickets), opened by Techy or an HR reply in the Inbox */}
        <RNModal isVisible={support.open} useNativeDriver useNativeDriverForBackdrop hideModalContentWhileAnimating
          onBackdropPress={() => setSupport({ open: false })} onBackButtonPress={() => setSupport({ open: false })}
          style={{ margin: 0, justifyContent: 'flex-end' }}>
          <SupportChatUI onClose={() => setSupport({ open: false })} ticketId={support.ticketId} />
        </RNModal>
      </SafeAreaView>
    </GlowScreen>
  );
}
