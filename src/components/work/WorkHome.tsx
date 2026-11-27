// WorkHome (Work v2): Home when WORK_V2 is on. Today's job (or the next) from the new jobs, time in/out through
// the database (lib/work/useWork), the check / problem / "When did you leave?" dialogs, and Arrived / Done /
// overtime while timed in on a job. The shared parts (Support chat, push, offline sending) stay on the Home tab.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWork } from '../../lib/work/useWork';
import { onPunchRequest } from '../../lib/work/punchRequest';
import { getMyWorkJobs, type MyJob } from '../../lib/work/workApi';
import { getMyLeaves } from '../../lib/leaves';
import { manilaDay, watchMyJobs, type Job } from '../../lib/jobs';
import { useT } from '../../lib/i18n';
import { appAlert, techy } from '../../ui';
import { router, type Href } from 'expo-router';
import { previewLeftAt } from '../../lib/forgottenShift';
import { startLocationUpdates } from '../../lib/liveLocation';
import { useFocusRefresh } from '../../lib/useFocusRefresh';
import HomeBody from '../home/HomeBody';
import type { ShiftState } from '../home/TimeInCard';
import TimeInProblemSheet from '../timein/TimeInProblemSheet';
import ForgottenShiftSheet from '../timein/ForgottenShiftSheet';
import WorkCheckSheet from './WorkCheckSheet';
import EarlyTimeOutSheet from './EarlyTimeOutSheet';
import JobProgressCard from './JobProgressCard';
import FaceCheckSheet from '../face/FaceCheckSheet';
import { whenBackOnline } from '../../lib/online';

const ASSIGNMENT: Record<string, string> = { on_site: 'on_site', out_of_town: 'deployment', in_house: 'in_house' };

/** The job you timed in on, else today's urgent (VIP) job, else today's job, else the next one; shaped like the Home card expects (one day of it). */
function pickJob(jobs: MyJob[], timedInJobId?: string | null): { card: Job | null; job: MyJob | null } {
  const today = manilaDay(new Date());
  const live = jobs.filter((j) => j.status !== 'cancelled' && j.end_date >= today);
  const job = live.find((j) => j.id === timedInJobId) ?? live.find((j) => j.is_vip && j.start_date <= today) ?? live.find((j) => j.start_date <= today) ?? live[0] ?? null;
  if (!job) return { card: null, job: null };
  const day = job.start_date <= today ? today : job.start_date;
  const at = (time: string) => new Date(`${day}T${time.slice(0, 8)}+08:00`).toISOString();
  return {
    job,
    card: {
      id: job.id, technician_id: null, client_name: job.client_name, location: job.address, start_time: at(job.start_time),
      end_time: at(job.end_time), status: job.status, assignment_type: ASSIGNMENT[job.work_type] ?? 'on_site',
      geofence_lat: job.site_lat, geofence_lon: job.site_lon, is_vip_hook: job.is_vip, cancellation_reason: job.cancel_reason,
    },
  };
}

/** Out-of-town: day n of the trip (dates are Manila days, 'YYYY-MM-DD'), for the progress bar on Home */
const tripDay = (start: string, end: string, today: string) => {
  const d = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1;
  return { day: d(start, today), days: d(start, end) };
};

export default function WorkHome() {
  const work = useWork();
  // "Time in" / "Time out" on a reminder push: run it here once Home has loaded today's day
  const latest = useRef(work);
  useEffect(() => { latest.current = work; });
  useEffect(() => onPunchRequest((p) => setTimeout(() => (p === 'in' ? latest.current.startTimeIn() : latest.current.timeOut()), 800)), []);
  const [jobs, setJobs] = useState<MyJob[]>([]);
  const [hideForgotten, setHideForgotten] = useState(false);
  const [leaveToday, setLeaveToday] = useState<string | null>(null); // approved leave covering today: its type
  // P1: any time-in (button, reminder push, arrival) refused for an open earlier day shows that day's window again
  useEffect(() => { if (work.forgotNudge) setHideForgotten(false); }, [work.forgotNudge]);
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;
  // Urgent (VIP) and high-priority jobs already seen; a new one for you is announced by Techy (C1). null = first load.
  const urgentSeen = useRef<Set<string> | null>(null);
  const loadJobs = useCallback(() => {
    getMyWorkJobs().then((list) => {
      const today = manilaDay(new Date());
      const urgent = list.filter((j) => j.mine && j.status !== 'cancelled' && j.end_date >= today && (j.is_vip || j.priority === 'high'));
      const fresh = urgentSeen.current && urgent.find((j) => !urgentSeen.current!.has(j.id));
      if (fresh) {
        const at = new Date(`${fresh.start_date}T${fresh.start_time.slice(0, 8)}+08:00`);
        const text = tRef.current('jobs.urgentSay', { client: fresh.client_name, when: at.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) });
        // P2: a pop-up the person can't miss (Techy's bubble didn't show on a real phone); Techy says it too
        appAlert(tRef.current('jobs.urgentTitle'), text, [{ text: tRef.current('jobs.later') }, { text: tRef.current('jobs.openJobs'), onPress: () => router.push('/(tabs)/jobs' as Href) }]);
        techy.say(text, { tone: 'error', mood: 'wave', ms: 8000 });
      }
      urgentSeen.current = new Set(urgent.map((j) => j.id));
      setJobs(list);
    }).catch(() => {});
    getMyLeaves().then((list) => {
      const today = manilaDay(new Date());
      setLeaveToday(list.find((l) => l.status === 'approved' && l.start_date <= today && today <= l.end_date)?.leave_type ?? null);
    }).catch(() => {});
  }, []);
  // C2: the office adds you to a job or changes it → Home updates by itself, no refresh
  useEffect(() => watchMyJobs(() => { loadJobs(); latest.current.reload().catch(() => {}); }), [loadJobs]);
  // Signal back: saved punches were just sent, so load the real day and jobs
  useEffect(() => whenBackOnline(() => { latest.current.reload().catch(() => {}); loadJobs(); }), [loadJobs]);
  useEffect(() => { loadJobs(); }, [loadJobs]);
  useFocusRefresh(() => { loadJobs(); work.reload().catch(() => {}); }, { onMount: false });

  const today = work.days.today;
  const { card, job } = useMemo(() => pickJob(jobs, today?.job_id), [jobs, today?.job_id]);
  const working = !!today && !today.time_out;

  // While timed in, the office's live map gets your position every minute
  const meId = work.me?.id;
  useEffect(() => {
    if (!working || !meId) return;
    return startLocationUpdates(meId);
  }, [working, meId]);

  const forgottenJob = jobs.find((j) => j.id === work.days.forgotten?.job_id);
  const forgotten = work.days.forgotten && !hideForgotten
    ? { id: work.days.forgotten.id, app_time_in: work.days.forgotten.time_in, app_time_out: null, total_hours: null, geofence_status: null }
    : null;

  const todayStr = manilaDay(new Date());
  const jobToday = !!job && job.start_date <= todayStr && todayStr <= job.end_date;
  // Andrew 27 Nov: Time in only for on-site and out-of-town jobs (VIP is an on-site job); in-house jobs don't use it
  const isInHouse = jobToday && job.work_type === 'in_house';
  const shift: ShiftState = today
    ? (today.time_out
      ? { kind: 'done', timeIn: today.time_in, timeOut: today.time_out, hours: today.hours != null ? Number(today.hours) : null }
      : { kind: 'working', startedAt: today.time_in, verified: today.in_check === 'inside' })
    : leaveToday
    ? { kind: 'leave', leaveType: leaveToday }
    : isInHouse
    ? { kind: 'in_house', clientName: job?.client_name }
    // Task 2 (27 Nov): only TODAY's job gives a start time; no job today = "No schedule today", no Time in button
    : { kind: 'off', shiftStart: jobToday ? card?.start_time : undefined };

  return (
    <>
      <HomeBody
        shift={shift}
        busy={work.busy}
        onTimeIn={() => work.startTimeIn()}
        onTimeOut={work.timeOut}
        job={card}
        onRefresh={async () => { loadJobs(); await work.reload(); }}
        jobExtra={working && job && today?.job_id === job.id ? <JobProgressCard jobId={job.id} reportTo={job.report_to} /> : null}
        trip={jobToday && job.work_type === 'out_of_town' ? tripDay(job.start_date, job.end_date, todayStr) : null}
      />

      <WorkCheckSheet key={work.sheet.open ? 'open' : 'closed'} sheet={work.sheet} sending={work.sending === 'selfie'}
        onRetry={work.retry} onSelfie={(reason) => work.sendSelfie(reason)} onClose={work.closeSheet} />
      <TimeInProblemSheet problem={work.problem} sending={work.sending}
        onRetry={() => work.selfie && work.sendSelfie(work.selfie.reason, true)} onTellHr={work.tellHr} onClose={work.closeProblem} />
      {work.face && <FaceCheckSheet key={work.face.tries} enrolled={work.face.enrolled} onEnrolled={work.enrollFace} onDone={work.faceDone} />}
      <EarlyTimeOutSheet early={work.early} busy={work.busy} onTimeOut={(reason) => work.sendTimeOut(reason)} onClose={work.closeEarly} />
      <ForgottenShiftSheet shift={forgotten} jobStart={forgottenJob?.start_time} jobEnd={forgottenJob?.end_time}
        // Checked, not `forgotten!.`: the React Compiler reads that path on every render, which crashed Home when it was null
        onSave={async (time) => (forgotten ? work.saveLeftAt(previewLeftAt(new Date(forgotten.app_time_in), time).leftAt) : false)}
        onLater={() => setHideForgotten(true)} />
    </>
  );
}
