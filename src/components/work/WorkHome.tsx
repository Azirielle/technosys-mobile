// WorkHome (Work v2): Home when WORK_V2 is on. Today's job (or the next) from the new jobs, time in/out through
// the database (lib/work/useWork), the check / problem / "When did you leave?" dialogs, and Arrived / Done /
// overtime while timed in on a job. The shared parts (Support chat, push, offline sending) stay on the Home tab.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useWork } from '../../lib/work/useWork';
import { getMyWorkJobs, type MyJob } from '../../lib/work/workApi';
import { manilaDay, type Job } from '../../lib/jobs';
import { previewLeftAt } from '../../lib/forgottenShift';
import { startLocationUpdates } from '../../lib/liveLocation';
import { useFocusRefresh } from '../../lib/useFocusRefresh';
import HomeBody from '../home/HomeBody';
import TimeInProblemSheet from '../timein/TimeInProblemSheet';
import ForgottenShiftSheet from '../timein/ForgottenShiftSheet';
import WorkCheckSheet from './WorkCheckSheet';
import EarlyTimeOutSheet from './EarlyTimeOutSheet';
import JobProgressCard from './JobProgressCard';

const ASSIGNMENT: Record<string, string> = { on_site: 'on_site', out_of_town: 'deployment', office: 'office_duty' };

/** The job you timed in on, else today's job, else the next one; shaped like the Home card expects (one day of it). */
function pickJob(jobs: MyJob[], timedInJobId?: string | null): { card: Job | null; job: MyJob | null } {
  const today = manilaDay(new Date());
  const live = jobs.filter((j) => j.status !== 'cancelled' && j.end_date >= today);
  const job = live.find((j) => j.id === timedInJobId) ?? live.find((j) => j.start_date <= today) ?? live[0] ?? null;
  if (!job) return { card: null, job: null };
  const day = job.start_date <= today ? today : job.start_date;
  const at = (time: string) => new Date(`${day}T${time.slice(0, 8)}+08:00`).toISOString();
  return {
    job,
    card: {
      id: job.id, technician_id: null, client_name: job.client_name, location: job.address, start_time: at(job.start_time),
      end_time: at(job.end_time), status: job.status, assignment_type: ASSIGNMENT[job.work_type] ?? 'on_site',
      geofence_lat: job.site_lat, geofence_lon: job.site_lon, is_vip_hook: false, cancellation_reason: job.cancel_reason,
    },
  };
}

export default function WorkHome() {
  const work = useWork();
  const [jobs, setJobs] = useState<MyJob[]>([]);
  const [hideForgotten, setHideForgotten] = useState(false);
  const loadJobs = useCallback(() => { getMyWorkJobs().then(setJobs).catch(() => {}); }, []);
  useEffect(() => { loadJobs(); }, [loadJobs]);
  useFocusRefresh(() => { loadJobs(); work.reload().catch(() => {}); }, { onMount: false });

  const today = work.days.today;
  const { card, job } = useMemo(() => pickJob(jobs, today?.job_id), [jobs, today?.job_id]);
  const working = !!today && !today.time_out;

  // While timed in, the office's live map gets your position every minute
  const meId = work.me?.id;
  useEffect(() => {
    if (!working || !meId) return;
    return startLocationUpdates(meId, work.me?.full_name ?? '');
  }, [working, meId]); // eslint-disable-line react-hooks/exhaustive-deps

  const forgotten = work.days.forgotten && !hideForgotten
    ? { id: work.days.forgotten.id, app_time_in: work.days.forgotten.time_in, app_time_out: null, total_hours: null, geofence_status: null }
    : null;

  return (
    <>
      <HomeBody
        shift={today
          ? (today.time_out
            ? { kind: 'done', timeIn: today.time_in, timeOut: today.time_out, hours: today.hours != null ? Number(today.hours) : null }
            : { kind: 'working', startedAt: today.time_in, verified: today.in_check === 'inside' })
          : { kind: 'off', shiftStart: card?.start_time }}
        busy={work.busy}
        onTimeIn={() => work.startTimeIn()}
        onTimeOut={work.timeOut}
        job={card}
        onRefresh={async () => { loadJobs(); await work.reload(); }}
        jobExtra={working && job && today?.job_id === job.id ? <JobProgressCard jobId={job.id} reportTo={job.report_to} /> : null}
      />

      <WorkCheckSheet key={work.sheet.open ? 'open' : 'closed'} sheet={work.sheet} sending={work.sending === 'selfie'}
        onRetry={work.retry} onSelfie={(reason) => work.sendSelfie(reason)} onClose={work.closeSheet} />
      <TimeInProblemSheet problem={work.problem} sending={work.sending}
        onRetry={() => work.selfie && work.sendSelfie(work.selfie.reason, true)} onTellHr={work.tellHr} onClose={work.closeProblem} />
      <EarlyTimeOutSheet early={work.early} busy={work.busy} onTimeOut={(reason) => work.sendTimeOut(reason)} onClose={work.closeEarly} />
      <ForgottenShiftSheet shift={forgotten}
        // Checked, not `forgotten!.`: the React Compiler reads that path on every render, which crashed Home when it was null
        onSave={async (time) => (forgotten ? work.saveLeftAt(previewLeftAt(new Date(forgotten.app_time_in), time).leftAt) : false)}
        onLater={() => setHideForgotten(true)} />
    </>
  );
}
