// Jobs for the Jobs tab: every job this person is on (the access rules return only those: lead, partner,
// driver or crew), split into now/next, later today, coming up and earlier, plus what the office changed
// this week (moved, cancelled, VIP squeeze-ins, crew added), read from schedule_history.
import { supabase } from './supabase';

export type WorkType = 'onSite' | 'outOfTown' | 'officeHq';
export type Job = {
  id: string;
  technician_id: string | null;
  client_name: string;
  location: string;
  start_time: string;
  end_time: string | null;
  status: string | null;
  assignment_type: string | null;
  geofence_lat: number | null;
  geofence_lon: number | null;
  is_vip_hook: boolean | null;
  cancellation_reason: string | null;
};
export type JobChange = {
  jobId: string;
  jobName: string;
  kind: 'moved' | 'cancelled' | 'added' | 'crew';
  at: string;
  reason: string | null;
  from?: string;
  to?: string;
  crew?: string;
};
export type MyJobs = {
  now: Job | null;          // the job you're on or the next one today; if none today, the next job at all
  nowIsToday: boolean;
  laterToday: Job[];
  upcoming: Job[];
  past: Job[];
  changes: JobChange[];      // newest first, last 7 days
  changeFor: Record<string, JobChange>; // latest change per job, for the badge on its card
};

/** schedules.assignment_type → the three kinds of work technicians know. */
export function workTypeOf(assignmentType: string | null | undefined): WorkType {
  if (assignmentType === 'deployment') return 'outOfTown';
  if (assignmentType === 'office_duty') return 'officeHq';
  return 'onSite';
}

// Manila is UTC+8 with no daylight saving, so this works on every phone (no time-zone database needed)
export const manilaDay = (iso: string | Date) => new Date(new Date(iso).getTime() + 8 * 3600000).toISOString().slice(0, 10);
const DAY = 86400000;
const ADDED_IS_NEWS_FOR = 2 * DAY; // every job has a "created" entry; only recent ones are worth showing

async function getChanges(jobs: Job[]): Promise<JobChange[]> {
  if (!jobs.length) return [];
  const { data, error } = await supabase
    .from('schedule_history')
    .select('schedule_id, action_type, previous_payload, new_payload, reason, created_at')
    .in('schedule_id', jobs.map((j) => j.id))
    .in('action_type', ['rescheduled', 'cancelled', 'created', 'crew_added'])
    .gte('created_at', new Date(Date.now() - 7 * DAY).toISOString())
    .order('created_at', { ascending: false });
  if (error) throw error;
  const name = (id: string) => jobs.find((j) => j.id === id)?.client_name ?? '';
  const out: JobChange[] = [];
  for (const h of data ?? []) {
    const prev = (h.previous_payload ?? {}) as Record<string, string>;
    const next = (h.new_payload ?? {}) as Record<string, string>;
    const base = { jobId: h.schedule_id, jobName: name(h.schedule_id), at: h.created_at, reason: h.reason };
    if (h.action_type === 'rescheduled') out.push({ ...base, kind: 'moved', from: prev.start_time, to: next.start_time });
    else if (h.action_type === 'cancelled') out.push({ ...base, kind: 'cancelled' });
    else if (h.action_type === 'crew_added') out.push({ ...base, kind: 'crew', crew: next.crew });
    else if (Date.now() - Date.parse(h.created_at) < ADDED_IS_NEWS_FOR) out.push({ ...base, kind: 'added', reason: null });
  }
  return out;
}

export async function getMyJobs(): Promise<MyJobs> {
  const { data, error } = await supabase
    .from('schedules')
    .select('id, technician_id, client_name, location, start_time, end_time, status, assignment_type, geofence_lat, geofence_lon, is_vip_hook, cancellation_reason')
    .gte('start_time', new Date(Date.now() - 30 * DAY).toISOString())
    .order('start_time', { ascending: true })
    .limit(80);
  if (error) throw error;
  const all = (data ?? []) as Job[];
  const changes = await getChanges(all);
  const today = manilaDay(new Date());
  const live = all.filter((j) => j.status !== 'cancelled');
  const todays = live.filter((j) => manilaDay(j.start_time) === today);
  const upcomingAll = live.filter((j) => manilaDay(j.start_time) > today);
  const older = live.filter((j) => manilaDay(j.start_time) < today);

  // The job you're on now, or the next one today: not finished and not already over
  const current = todays.find((j) => j.status !== 'completed' && (!j.end_time || Date.parse(j.end_time) > Date.now())) ?? null;
  const rest = todays.filter((j) => j !== current);
  const laterToday = rest.filter((j) => j.status !== 'completed' && Date.parse(j.start_time) > Date.now());
  const doneToday = rest.filter((j) => !laterToday.includes(j));

  const changeFor: Record<string, JobChange> = {};
  for (const ch of changes) if (!changeFor[ch.jobId]) changeFor[ch.jobId] = ch;
  return {
    now: current ?? upcomingAll[0] ?? null,
    nowIsToday: !!current,
    laterToday,
    upcoming: current ? upcomingAll : upcomingAll.slice(1),
    past: [...doneToday, ...older].reverse().slice(0, 8),
    changes,
    changeFor,
  };
}

/** Calls `onChange` when the office edits any job you can see (moves, cancels, adds). Returns the unsubscribe. */
export function watchMyJobs(onChange: () => void): () => void {
  const channel = supabase
    .channel(`my-jobs-${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => onChange())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
