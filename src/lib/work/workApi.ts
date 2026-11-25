// Work v2 data for the phone: today's work day, your jobs, and the database functions that time you in and
// out (they decide everything: window, phone, distance, late, driver rule). Every call returns the
// database's plain status; lib/work/workMessages.ts turns it into words.
import { supabase } from '../supabase';
import { getDeviceId } from '../deviceId';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncQueue } from '../syncQueue';
import { offlineCheck } from './offlineCheck';
import { uploadPhoto } from '../photoUpload';
import type { Spot } from '../timeIn';

export const WORK_V2 = true; // on since the switch-over on 2026-11-17 (PROJECT_STATE.md §8)

export type WorkResult = { status: string; [key: string]: unknown };
export type WorkDay = {
  id: string; work_date: string; job_id: string | null; place: 'site' | 'hq'; place_name: string; time_in: string;
  time_out: string | null; late_minutes: number; in_check: string; hours: number | null; status: string;
};
export type MyJob = {
  id: string; client_name: string; address: string; project_name: string | null; notes: string | null;
  site_lat: number; site_lon: number; site_radius_m: number; start_date: string; end_date: string;
  start_time: string; end_time: string; work_type: string; report_to: 'site' | 'hq'; status: string; cancel_reason: string | null; is_vip: boolean; priority: string;
  role: string; vehicle: string | null;
  /** You're still on this job's crew (not taken off it) */
  mine: boolean;
};

const isNetwork = (e: unknown) => /fetch|network|timeout/i.test(String((e as { message?: string })?.message ?? e));

const JOBS_KEY = 'MY_WORK_JOBS'; // your jobs as last loaded, for the no-signal check before a time-in

/** No signal: first the phone's own check (time-in), then kept on the phone and sent later with the time it was taken */
async function saveForLater(fn: 'time_in' | 'time_out', args: Record<string, unknown>, check?: () => Promise<WorkResult | null>): Promise<WorkResult> {
  const stop = await check?.();
  if (stop) return stop;
  const at = new Date().toISOString();
  await syncQueue.addToQueue(fn === 'time_in' ? 'work_time_in' : 'work_time_out', { ...args, p_queued_at: at });
  return { status: 'queued', queued_at: at };
}

async function call(fn: 'time_in' | 'time_out', args: Record<string, unknown>, check?: () => Promise<WorkResult | null>): Promise<WorkResult> {
  const { data, error } = await supabase.rpc(fn, args as never);
  if (error) {
    if (!isNetwork(error)) return { status: error.message.includes('Not signed in') ? 'signed_out' : 'error' };
    return saveForLater(fn, args, check);
  }
  return (data ?? { status: 'error' }) as WorkResult;
}

/** Your jobs as loaded in the last 24 h, or null (never loaded, or too old to trust: then nothing is stopped). */
async function savedJobs(): Promise<MyJob[] | null> {
  try {
    const saved = JSON.parse((await AsyncStorage.getItem(JOBS_KEY)) ?? 'null') as { at: number; jobs: MyJob[] } | null;
    return saved && Date.now() - saved.at < 86400000 ? saved.jobs : null;
  } catch { return null; }
}

/** Time in. Without a selfie the server answers outside / fake_gps / need_selfie when it can't confirm the site. */
/** With `selfieUri` (a selfie taken with no signal, see lib/work/offlineResult) it's saved for later straight away. */
export async function workTimeIn(here: Spot | null, extra: { selfiePath?: string; selfieUri?: string; reason?: string; officeDuty?: boolean } = {}) {
  const args = {
    p_lat: here?.lat ?? null, p_lon: here?.lon ?? null, p_accuracy_m: here?.accuracy ?? null, p_mocked: here?.isMocked ?? false,
    p_device_id: await getDeviceId(), p_selfie_path: extra.selfiePath ?? null, p_reason: extra.reason ?? null, p_office_duty: extra.officeDuty ?? false,
  };
  const check = async () => { const jobs = await savedJobs(); return jobs && offlineCheck(jobs, here, !!extra.officeDuty, !!(extra.selfiePath || extra.selfieUri)); };
  if (extra.selfieUri) return saveForLater('time_in', { ...args, selfie_uri: extra.selfieUri }, check);
  return call('time_in', args, check);
}

/** Time out. More than 15 min before the end the server answers "early" until a reason is sent. */
export async function workTimeOut(here: Spot | null, reason?: string) {
  return call('time_out', { p_lat: here?.lat ?? null, p_lon: here?.lon ?? null, p_device_id: await getDeviceId(), p_reason: reason ?? null });
}

/** Selfie for a time-in outside the site: private bucket, path must start with your id (the server checks). */
export async function uploadWorkSelfie(userId: string, uri: string): Promise<string> {
  const path = `${userId}-${Date.now()}.jpg`;
  await uploadPhoto('dtr-selfies', path, uri);
  return path;
}

export async function reportLeftAt(workDayId: string, leftAt: Date): Promise<WorkResult> {
  const { data, error } = await supabase.rpc('report_left_at', { p_work_day_id: workDayId, p_left_at: leftAt.toISOString() });
  return error ? { status: 'error' } : (data as WorkResult);
}

export async function markProgress(jobId: string, kind: 'arrived' | 'done', here: Spot | null): Promise<WorkResult> {
  const { data, error } = await supabase.rpc('mark_job_progress', { p_job_id: jobId, p_kind: kind, p_lat: here?.lat ?? null, p_lon: here?.lon ?? null } as never);
  return error ? { status: 'error' } : (data as WorkResult);
}

export async function askOvertime(hours: number, reason: string): Promise<WorkResult> {
  const { data, error } = await supabase.rpc('request_overtime', { p_hours: hours, p_reason: reason });
  return error ? { status: 'error' } : (data as WorkResult);
}

/** Today's work day (Manila), and an earlier day still without a time-out. */
export async function getMyDays(): Promise<{ today: WorkDay | null; forgotten: WorkDay | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { today: null, forgotten: null };
  const todayDate = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  const { data } = await supabase.from('work_days')
    .select('id, work_date, job_id, place, place_name, time_in, time_out, late_minutes, in_check, hours, status')
    .eq('person_id', user.id).or(`work_date.eq.${todayDate},time_out.is.null`).order('work_date', { ascending: false });
  const days = (data ?? []) as WorkDay[];
  return { today: days.find((d) => d.work_date === todayDate) ?? null, forgotten: days.find((d) => d.work_date < todayDate && !d.time_out) ?? null };
}

/** Jobs you're on (the access rules return only those), with your role and, for drivers, the vehicle. */
export async function getMyWorkJobs(): Promise<MyJob[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase.from('jobs')
    .select(`id, client_name, address, project_name, notes, site_lat, site_lon, site_radius_m, start_date, end_date, start_time, end_time,
      work_type, report_to, status, cancel_reason, is_vip, priority, job_members ( person_id, role, removed_at, vehicle:vehicles ( name, plate ) )`)
    .gte('end_date', since).order('start_date').order('start_time');
  if (error) throw error;
  const jobs = (data ?? []).map(({ job_members, ...j }) => {
    const me = (job_members ?? []).find((m) => m.person_id === user.id && !m.removed_at);
    const v = me?.vehicle as { name?: string; plate?: string } | null;
    return { ...(j as Omit<MyJob, 'role' | 'vehicle' | 'mine'>), role: me?.role ?? 'crew', vehicle: v ? `${v.name} · ${v.plate}` : null, mine: !!me };
  });
  AsyncStorage.setItem(JOBS_KEY, JSON.stringify({ at: Date.now(), jobs })).catch(() => {});
  // Tell the office the app has shown you these jobs (an unseen urgent job tells the Coordinator to call you)
  const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  const shown = jobs.filter((j) => j.mine && j.status !== 'cancelled' && j.end_date >= today).map((j) => j.id);
  if (shown.length) supabase.rpc('mark_jobs_seen', { p_job_ids: shown }).then(() => {}, () => {});
  return jobs;
}
