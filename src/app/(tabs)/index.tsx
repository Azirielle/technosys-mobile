// Home tab: what you see (components/home/HomeBody), time in/out (lib/useTimeIn) with its three dialogs
// (components/timein), and the Support chat pop-up that Techy and the Inbox open (lib/homeActions).
// Everything else opens as its own full screen.
import React, { useCallback, useEffect, useState } from 'react';
import RNModal from 'react-native-modal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { syncQueue } from '../../lib/syncQueue';
import { getHomeJob, watchMyJobs, type HomeJob } from '../../lib/jobs';
import { useTimeIn } from '../../lib/useTimeIn';
import { startLocationUpdates } from '../../lib/liveLocation';
import { onHomeAction } from '../../lib/homeActions';
import { useFocusRefresh } from '../../lib/useFocusRefresh';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import SupportChatUI from '../../components/SupportChatUI';
import HomeBody from '../../components/home/HomeBody';
import TimeInCheckSheet from '../../components/timein/TimeInCheckSheet';
import TimeInProblemSheet from '../../components/timein/TimeInProblemSheet';
import ForgottenShiftSheet from '../../components/timein/ForgottenShiftSheet';
import { GlowScreen } from '../../ui';

export default function HomeScreen() {
  usePushNotifications(); // registers this phone for push notifications
  const [job, setJob] = useState<HomeJob | null>(null);
  const [support, setSupport] = useState<{ open: boolean; ticketId?: string }>({ open: false });
  const timeIn = useTimeIn(job);
  const { me, shift } = timeIn;

  const loadJob = useCallback(() => { getHomeJob().then(setJob).catch(() => {}); }, []);
  useEffect(() => { loadJob(); return watchMyJobs(loadJob); }, [loadJob]);

  // Time-ins and time-outs saved on the phone without signal are sent when Home opens or comes back
  useFocusRefresh(() => { syncQueue.syncPendingQueue().catch(() => {}); });

  // While timed in, the office's live map gets your position every minute
  const activeId = shift.active?.id;
  useEffect(() => {
    if (!activeId || !me) return;
    return startLocationUpdates(me.id, me.full_name ?? '');
  }, [activeId, me]);

  useEffect(() => onHomeAction((action) => {
    if (action.kind === 'support') setSupport({ open: true, ticketId: action.ticketId });
  }), []);

  const active = shift.active;
  const done = shift.done;

  return (
    <GlowScreen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <HomeBody
          shift={active
            ? { kind: 'working', startedAt: active.app_time_in, verified: active.geofence_status === 'inside' }
            : done
            ? { kind: 'done', timeIn: done.app_time_in, timeOut: done.app_time_out, hours: done.total_hours != null ? Number(done.total_hours) : null }
            : { kind: 'off', shiftStart: job?.start_time }}
          busy={timeIn.timingOut}
          onTimeIn={timeIn.startTimeIn}
          onTimeOut={timeIn.timeOut}
          job={job}
          onRefresh={async () => { loadJob(); await timeIn.reload(); }}
        />

        <TimeInCheckSheet check={timeIn.check} address={job?.location} sending={timeIn.sending === 'selfie'}
          onSelfie={() => timeIn.sendSelfie()} onClose={timeIn.closeCheck} />
        <TimeInProblemSheet problem={timeIn.problem} sending={timeIn.sending}
          onRetry={() => timeIn.sendSelfie(true)} onTellHr={timeIn.tellHr} onClose={timeIn.closeProblem} />
        <ForgottenShiftSheet shift={timeIn.forgotten} onSave={timeIn.saveForgotten} onLater={timeIn.laterForgotten} />

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
