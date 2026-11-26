// Jobs for the Jobs tab: every job this person is on (the access rules return only those: lead, partner,
// driver or crew), split into now/next, later today, coming up and earlier, plus what the office changed
// this week (moved, cancelled, VIP squeeze-ins, crew added), read from schedule_history.
// With WORK_V2 on, the same lists come from the new jobs tables (lib/work/workJobs).
import { supabase } from './supabase';
import { WORK_V2 } from './work/workApi';
import { loadWorkJobs } from './work/workJobs';

export type WorkType = 'onSite' | 'outOfTown' | 'officeHq' | 'inHouse';
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
  /** Work v2 jobs: low / medium / high (a VIP squeeze-in shows as Urgent instead) */
  priority?: string;
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
  is_vip_hook?: boolean | null;
  priority?: string;
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

/** schedules.assignment_type → the four kinds of work technicians know. */
export function workTypeOf(assignmentType: string | null | undefined): WorkType {
  if (assignmentType === 'deployment' || assignmentType === 'out_of_town') return 'outOfTown';
  if (assignmentType === 'office_duty' || assignmentType === 'office') return 'officeHq';
  if (assignmentType === 'in_house') return 'inHouse';
  return 'onSite';
}

// Manila is UTC+8 with no daylight saving, so this works on every phone (no time-zone database needed)
import { manilaDay } from './manilaDay';
export { manilaDay };
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
  const job = (id: string) => jobs.find((j) => j.id === id);
  const out: JobChange[] = [];
  for (const h of data ?? []) {
    const prev = (h.previous_payload ?? {}) as Record<string, string>;
    const next = (h.new_payload ?? {}) as Record<string, string>;
    const j = job(h.schedule_id);
    const base = {
      jobId: h.schedule_id,
      jobName: name(h.schedule_id),
      at: h.created_at,
      reason: h.reason,
      is_vip_hook: j?.is_vip_hook,
      priority: j?.priority,
    };
    if (h.action_type === 'rescheduled') out.push({ ...base, kind: 'moved', from: prev.start_time, to: next.start_time });
    else if (h.action_type === 'cancelled') out.push({ ...base, kind: 'cancelled' });
    else if (h.action_type === 'crew_added') out.push({ ...base, kind: 'crew', crew: next.crew });
    else if (Date.now() - Date.parse(h.created_at) < ADDED_IS_NEWS_FOR) out.push({ ...base, kind: 'added', reason: null });
  }
  return out;
}

export async function getMyJobs(): Promise<MyJobs> {
  let all: Job[];
  let changes: JobChange[];
  if (WORK_V2) {
    ({ jobs: all, changes } = await loadWorkJobs());
  } else {
    const { data, error } = await supabase
      .from('schedules')
      .select('id, technician_id, client_name, location, start_time, end_time, status, assignment_type, geofence_lat, geofence_lon, is_vip_hook, cancellation_reason')
      .gte('start_time', new Date(Date.now() - 30 * DAY).toISOString())
      .order('start_time', { ascending: true })
      .limit(80);
    if (error) throw error;
    all = (data ?? []) as Job[];
    changes = await getChanges(all);
  }
  const today = manilaDay(new Date());
  const live = all.filter((j) => j.status !== 'cancelled');
  const todays = live.filter((j) => manilaDay(j.start_time) === today);
  const upcomingAll = live.filter((j) => manilaDay(j.start_time) > today);
  const older = live.filter((j) => manilaDay(j.start_time) < today);

  // The job you're on now, or the next one today: not finished and not already over. An urgent (VIP) job comes first, then a high-priority one.
  const open = todays.filter((j) => j.status !== 'completed' && (!j.end_time || Date.parse(j.end_time) > Date.now()));
  const current = open.find((j) => j.is_vip_hook) ?? open.find((j) => j.priority === 'high') ?? open[0] ?? null;
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

export type HomeJob = Job & { geofence_radius: number | null };

/** Home's job (and the time-in site): today's job, or the next one. The first job that hasn't ended before today. */
export async function getHomeJob(): Promise<HomeJob | null> {
  const todayStart = new Date(Date.parse(`${manilaDay(new Date())}T00:00:00+08:00`)).toISOString();
  const { data } = await supabase
    .from('schedules')
    .select('id, technician_id, client_name, location, start_time, end_time, status, assignment_type, geofence_lat, geofence_lon, geofence_radius, is_vip_hook, cancellation_reason')
    .neq('status', 'cancelled')
    .or(`end_time.gte.${todayStart},start_time.gte.${todayStart}`)
    .order('start_time', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as HomeJob | null) ?? null;
}

/** Calls `onChange` when the office edits any job you can see (moves, cancels, adds). Returns the unsubscribe. */
export function watchMyJobs(onChange: () => void): () => void {
  const channel = supabase
    .channel(`my-jobs-${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: WORK_V2 ? 'jobs' : 'schedules' }, () => onChange())
    // Being added to (or taken off) a job changes job_members, not jobs (C2: an urgent job showed only after a refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'job_members' }, () => onChange())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
