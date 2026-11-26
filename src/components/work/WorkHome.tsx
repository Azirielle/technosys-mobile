// WorkHome (Work v2): Home when WORK_V2 is on. Today's job (or the next) from the new jobs, time in/out through
// the database (lib/work/useWork), the check / problem / "When did you leave?" dialogs, and Arrived / Done /
// overtime while timed in on a job. The shared parts (Support chat, push, offline sending) stay on the Home tab.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { getDistance } from 'geolib';
import { useWork } from '../../lib/work/useWork';
import { onPunchRequest } from '../../lib/work/punchRequest';
import { getMyWorkJobs, type MyJob } from '../../lib/work/workApi';
import { manilaDay, type Job } from '../../lib/jobs';
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

const ASSIGNMENT: Record<string, string> = { on_site: 'on_site', out_of_town: 'deployment', office: 'office_duty', in_house: 'in_house' };

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

export default function WorkHome() {
  const work = useWork();
  // "Time in" / "Time out" on a reminder push: run it here once Home has loaded today's day
  const latest = useRef(work);
  useEffect(() => { latest.current = work; });
  useEffect(() => onPunchRequest((p) => setTimeout(() => (p === 'in' ? latest.current.startTimeIn() : latest.current.timeOut()), 800)), []);
  const [jobs, setJobs] = useState<MyJob[]>([]);
  const [hideForgotten, setHideForgotten] = useState(false);
  const loadJobs = useCallback(() => { getMyWorkJobs().then(setJobs).catch(() => {}); }, []);
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

  const forgotten = work.days.forgotten && !hideForgotten
    ? { id: work.days.forgotten.id, app_time_in: work.days.forgotten.time_in, app_time_out: null, total_hours: null, geofence_status: null }
    : null;

  const todayStr = manilaDay(new Date());
  const isInHouse = job?.work_type === 'in_house' && job.start_date <= todayStr && todayStr <= job.end_date;
  const atOffice = !today && !!work.days.officeCheckIn;
  const autoTriggered = useRef(false);

  useEffect(() => {
    if (!atOffice || !job?.site_lat || !job?.site_lon) return;
    autoTriggered.current = false;
    const checkSiteArrival = async () => {
      if (autoTriggered.current) return;
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const dist = getDistance(
          { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
          { latitude: job.site_lat, longitude: job.site_lon }
        );
        if (dist <= (job.site_radius_m || 75)) {
          autoTriggered.current = true;
          latest.current.startTimeIn();
        }
      } catch { /* GPS unavailable or permission off */ }
    };

    checkSiteArrival();
    const interval = setInterval(checkSiteArrival, 10000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        latest.current.reload().catch(() => {});
        checkSiteArrival();
      }
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [atOffice, job?.site_lat, job?.site_lon, job?.site_radius_m]); // not `work`: it changes every render and would re-arm the watch

  const shift: ShiftState = today
    ? (today.time_out
      ? { kind: 'done', timeIn: today.time_in, timeOut: today.time_out, hours: today.hours != null ? Number(today.hours) : null }
      : { kind: 'working', startedAt: today.time_in, verified: today.in_check === 'inside' })
    : atOffice
    ? { kind: 'at_office', checkedInAt: work.days.officeCheckIn!.checked_in_at, clientName: job?.client_name }
    : isInHouse
    ? { kind: 'in_house', clientName: job?.client_name }
    : { kind: 'off', shiftStart: card?.start_time, canCheckInOffice: job?.work_type === 'on_site' };

  return (
    <>
      <HomeBody
        shift={shift}
        jobShift={today && job && today.job_id === job.id ? shift : undefined}
        busy={work.busy}
        onTimeIn={() => work.startTimeIn()}
        onTimeOut={work.timeOut}
        onOfficeCheckIn={work.startOfficeCheckIn}
        job={card}
        onRefresh={async () => { loadJobs(); await work.reload(); }}
        jobExtra={working && job && today?.job_id === job.id ? <JobProgressCard jobId={job.id} reportTo={job.report_to} /> : null}
      />

      <WorkCheckSheet key={work.sheet.open ? 'open' : 'closed'} sheet={work.sheet} sending={work.sending === 'selfie'}
        onRetry={work.retry} onSelfie={(reason) => work.sendSelfie(reason)} onClose={work.closeSheet} />
      <TimeInProblemSheet problem={work.problem} sending={work.sending}
        onRetry={() => work.selfie && work.sendSelfie(work.selfie.reason, true)} onTellHr={work.tellHr} onClose={work.closeProblem} />
      {work.face && <FaceCheckSheet enrolled={work.face.enrolled} onEnrolled={work.enrollFace} onDone={work.faceDone} />}
      <EarlyTimeOutSheet early={work.early} busy={work.busy} onTimeOut={(reason) => work.sendTimeOut(reason)} onClose={work.closeEarly} />
      <ForgottenShiftSheet shift={forgotten}
        // Checked, not `forgotten!.`: the React Compiler reads that path on every render, which crashed Home when it was null
        onSave={async (time) => (forgotten ? work.saveLeftAt(previewLeftAt(new Date(forgotten.app_time_in), time).leftAt) : false)}
        onLater={() => setHideForgotten(true)} />
    </>
  );
}
