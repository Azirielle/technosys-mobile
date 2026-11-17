// ClassicHome: Home with the current time-in (schedules + attendance_logs, lib/useTimeIn). Used until the Work v2
// switch-over (WORK_V2 in lib/work/workApi.ts); then components/work/WorkHome takes its place.
import React, { useCallback, useEffect, useState } from 'react';
import { getHomeJob, watchMyJobs, type HomeJob } from '../../lib/jobs';
import { useTimeIn } from '../../lib/useTimeIn';
import { startLocationUpdates } from '../../lib/liveLocation';
import HomeBody from './HomeBody';
import TimeInCheckSheet from '../timein/TimeInCheckSheet';
import TimeInProblemSheet from '../timein/TimeInProblemSheet';
import ForgottenShiftSheet from '../timein/ForgottenShiftSheet';

export default function ClassicHome() {
  const [job, setJob] = useState<HomeJob | null>(null);
  const timeIn = useTimeIn(job);
  const { me, shift } = timeIn;

  const loadJob = useCallback(() => { getHomeJob().then(setJob).catch(() => {}); }, []);
  useEffect(() => { loadJob(); return watchMyJobs(loadJob); }, [loadJob]);

  // While timed in, the office's live map gets your position every minute
  const activeId = shift.active?.id;
  useEffect(() => {
    if (!activeId || !me) return;
    return startLocationUpdates(me.id, me.full_name ?? '');
  }, [activeId, me]);

  const active = shift.active;
  const done = shift.done;

  return (
    <>
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
    </>
  );
}
