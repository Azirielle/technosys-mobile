// The DTR tab's numbers, using the same rules as the admin DTR (Admin-side app/actions/audit.ts, confirmed by
// Andrew on 15 Nov 2026): shift starts 8:00 (or the job's start), late only after 15 minutes of grace,
// 1-hour meal break off shifts over 5 hours, overtime only up to what HR approved, Sunday/holiday hours all
// count as rest-day overtime, night shift = hours between 10 PM and 6 AM, absent = a past Mon–Sat with no
// time-in, leave or holiday. Only the first time-in of a day counts. Manila time is UTC+8 (no daylight saving).
// With WORK_V2 on, days come from work_days, using the hours and late minutes the database worked out.
import { supabase } from './supabase';
import { WorkType, workTypeOf } from './jobs';
import { WORK_V2 } from './work/workApi';

type LogRow = { id: string; app_time_in: string | null; app_time_out: string | null; status: string | null; hours?: number | null; late?: number };
type JobRow = { id: string; client_name: string; start_time: string; assignment_type: string | null };
const ASSIGNMENT: Record<string, string> = { on_site: 'on_site', out_of_town: 'deployment', office: 'office_duty' };

/** Work v2: this cut-off's work days as the rows the DTR loop reads (hours and late from the database). */
async function workDayRows(userId: string, cut: Cutoff): Promise<{ logs: LogRow[]; jobs: JobRow[] }> {
  const { data, error } = await supabase.from('work_days')
    .select('id, work_date, time_in, time_out, hours, late_minutes, status, job:jobs ( client_name, start_time, work_type )')
    .eq('person_id', userId).gte('work_date', cut.start).lte('work_date', cut.end).order('work_date');
  if (error) throw error;
  const logs: LogRow[] = []; const jobs: JobRow[] = [];
  for (const d of data ?? []) {
    logs.push({ id: d.id, app_time_in: d.time_in, app_time_out: d.time_out, hours: d.hours, late: d.late_minutes,
      status: d.status === 'needs_review' || d.status === 'no_time_out' ? 'pending_close' : 'closed' });
    const j = d.job as { client_name?: string; start_time?: string; work_type?: string } | null;
    if (j?.start_time) jobs.push({ id: d.id, client_name: j.client_name ?? '', start_time: new Date(`${d.work_date}T${j.start_time.slice(0, 8)}+08:00`).toISOString(), assignment_type: ASSIGNMENT[j.work_type ?? ''] ?? 'on_site' });
  }
  return { logs, jobs };
}

const H = 3600000;
const MANILA = 8 * H;
const GRACE_MIN = 15;
const SHIFT_START_HOUR = 8;

/** YYYY-MM-DD in Manila */
export const manilaDate = (d: Date | string | number) => new Date(new Date(d).getTime() + MANILA).toISOString().slice(0, 10);
const manilaHour = (ms: number) => new Date(ms + MANILA).getUTCHours();
const dayStartMs = (ymd: string) => Date.parse(`${ymd}T00:00:00Z`) - MANILA;

export type Cutoff = { start: string; end: string };
/** Cut-offs are the 1st–15th and the 16th–end of the month. */
export function cutoffFor(ymd: string): Cutoff {
  const [y, m, d] = ymd.split('-').map(Number);
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return d! <= 15 ? { start: `${y}-${mm}-01`, end: `${y}-${mm}-15` } : { start: `${y}-${mm}-16`, end: `${y}-${mm}-${last}` };
}
export function shiftCutoff(c: Cutoff, step: -1 | 1): Cutoff {
  const ref = new Date(Date.parse(`${step === 1 ? c.end : c.start}T00:00:00Z`) + step * 86400000);
  return cutoffFor(ref.toISOString().slice(0, 10));
}

export type DtrDay = {
  date: string;
  timeIn?: string; timeOut?: string;
  hours: number;
  lateMin: number; expectedStart?: string;
  ot: number; unapprovedOt: number; restDayOt: number; night: number;
  workType?: WorkType; jobName?: string;
  state: 'worked' | 'open' | 'working' | 'checking' | 'leave' | 'holiday' | 'absent';
  holidayName?: string; leaveType?: string; mealTaken: boolean;
};
export type DtrResult = {
  days: DtrDay[]; workdays: number; workdaysSoFar: number; present: number; worked: number; ot: number; night: number; lates: number; absences: number;
  where: Record<WorkType, number>;
};

/** "Thu, Nov 6" (short) or "Thursday, November 6" (long) for a YYYY-MM-DD date. */
export const dayLabel = (ymd: string, long = false) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString([],
  long ? { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' } : { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** Night hours (10 PM–6 AM Manila) between two moments, in 15-minute steps like the admin. */
function nightHours(inMs: number, outMs: number) {
  let total = 0;
  for (let t = inMs; t < outMs; t += 15 * 60000) {
    const next = Math.min(t + 15 * 60000, outMs);
    const h = manilaHour((t + next) / 2);
    if (h >= 22 || h < 6) total += next - t;
  }
  return total / H;
}

export async function getMyDtr(cut: Cutoff): Promise<DtrResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const fromIso = new Date(dayStartMs(cut.start)).toISOString();
  const toIso = new Date(dayStartMs(cut.end) + 24 * H - 1).toISOString();

  const [logs, jobs, ot, leaves, holidays] = await Promise.all([
    supabase.from('attendance_logs').select('id, app_time_in, app_time_out, status').eq('technician_id', user.id)
      .gte('app_time_in', fromIso).lte('app_time_in', toIso).order('app_time_in'),
    supabase.from('schedules').select('id, client_name, start_time, assignment_type').neq('status', 'cancelled')
      .gte('start_time', fromIso).lte('start_time', toIso).order('start_time'),
    supabase.from('overtime_requests').select('request_date, requested_hours').eq('technician_id', user.id)
      .eq('status', 'approved').gte('request_date', cut.start).lte('request_date', cut.end),
    supabase.from('leaves').select('start_date, end_date, leave_type').eq('technician_id', user.id)
      .eq('status', 'approved').lte('start_date', cut.end).gte('end_date', cut.start),
    supabase.from('holidays').select('holiday_date, name').eq('is_active', true).gte('holiday_date', cut.start).lte('holiday_date', cut.end),
  ]);
  const failed = logs.error || jobs.error || ot.error || leaves.error || holidays.error;
  if (failed) throw failed;
  const v2 = WORK_V2 ? await workDayRows(user.id, cut) : null;
  const logRows: LogRow[] = v2?.logs ?? (logs.data ?? []);
  const jobRows: JobRow[] = v2?.jobs ?? (jobs.data ?? []);

  const today = manilaDate(new Date());
  const result: DtrResult = { days: [], workdays: 0, workdaysSoFar: 0, present: 0, worked: 0, ot: 0, night: 0, lates: 0, absences: 0, where: { onSite: 0, outOfTown: 0, officeHq: 0 } };

  for (let ms = Date.parse(`${cut.start}T00:00:00Z`); ms <= Date.parse(`${cut.end}T00:00:00Z`); ms += 86400000) {
    const date = new Date(ms).toISOString().slice(0, 10);
    const isSunday = new Date(ms).getUTCDay() === 0;
    const holiday = (holidays.data ?? []).find((h) => h.holiday_date === date);
    if (!isSunday && !holiday) { result.workdays += 1; if (date <= today) result.workdaysSoFar += 1; }
    const log = logRows.find((l) => l.app_time_in && manilaDate(l.app_time_in) === date);
    const job = jobRows.find((j) => manilaDate(j.start_time) === date);
    const leave = (leaves.data ?? []).find((l) => l.start_date <= date && l.end_date >= date);
    const approvedOt = (ot.data ?? []).filter((o) => o.request_date === date).reduce((s, o) => s + Number(o.requested_hours || 0), 0);
    const base: DtrDay = { date, hours: 0, lateMin: 0, ot: 0, unapprovedOt: 0, restDayOt: 0, night: 0, state: 'worked', mealTaken: false,
      workType: job ? workTypeOf(job.assignment_type) : undefined, jobName: job?.client_name, holidayName: holiday?.name };

    if (log?.app_time_in) {
      const inMs = Date.parse(log.app_time_in);
      const day: DtrDay = { ...base, timeIn: fmtTime(inMs), workType: base.workType ?? 'officeHq' };
      result.where[day.workType!] += 1;
      result.present += 1;
      if (!log.app_time_out) {
        day.state = date === today ? 'working' : 'open';
        result.days.push(day);
        continue;
      }
      const outMs = Date.parse(log.app_time_out);
      const gross = Math.max(0, (outMs - inMs) / H);
      // Work v2: the database's hours (from the start time, to the end time + approved overtime) and late minutes
      const net = log.hours != null ? Number(log.hours) : gross > 5 ? gross - 1 : gross;
      const expected = job ? Date.parse(job.start_time) : dayStartMs(date) + SHIFT_START_HOUR * H;
      const minsLate = log.late ?? Math.floor((inMs - expected) / 60000);
      Object.assign(day, {
        timeOut: fmtTime(outMs), hours: net, mealTaken: gross > 5, night: nightHours(inMs, outMs),
        lateMin: minsLate > GRACE_MIN ? minsLate : 0, expectedStart: fmtTime(expected),
        state: log.status === 'pending_close' ? 'checking' : 'worked',
      });
      if (isSunday || holiday) day.restDayOt = net;
      else if (net > 8) { day.ot = Math.min(net - 8, approvedOt); day.unapprovedOt = net - 8 - day.ot; }
      result.worked += net; result.ot += day.ot + day.restDayOt; result.night += day.night;
      if (day.lateMin) result.lates += 1;
      result.days.push(day);
    } else if (leave && !isSunday && !holiday) {
      result.days.push({ ...base, state: 'leave', leaveType: leave.leave_type });
    } else if (holiday) {
      result.days.push({ ...base, state: 'holiday' });
    } else if (!isSunday && date < today) {
      result.absences += 1;
      result.days.push({ ...base, state: 'absent' });
    }
  }
  result.days.reverse(); // newest first
  result.days.forEach((d) => dayCache.set(d.date, d));
  return result;
}

// The DTR tab keeps the days it loaded so a day's screen opens instantly.
const dayCache = new Map<string, DtrDay>();
export const getCachedDay = (date: string) => dayCache.get(date);

export type DayDetails = {
  geofence: 'inside' | 'outside' | 'unknown' | null;
  selfie: boolean;
  typedInLater: boolean;
  corrections: { when: string; reason: string; before: string | null; after: string | null; what: 'in' | 'out' | 'both' }[];
};

/** Extra facts for one day's screen: where the time-in happened, the selfie, and HR's corrections. */
export async function getDayDetails(date: string): Promise<DayDetails> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const from = new Date(dayStartMs(date)).toISOString();
  const to = new Date(dayStartMs(date) + 24 * H - 1).toISOString();
  if (WORK_V2) {
    const { data: wd, error } = await supabase.from('work_days').select('in_check, selfie_path, status, out_check')
      .eq('person_id', user.id).eq('work_date', date).maybeSingle();
    if (error) throw error;
    return {
      geofence: wd ? (wd.in_check === 'selfie' ? 'outside' : 'inside') : null,
      selfie: !!wd?.selfie_path,
      typedInLater: wd?.out_check === 'told_later' || wd?.out_check === 'by_coordinator' || wd?.status === 'needs_review',
      corrections: [],
    };
  }
  const [log, corr] = await Promise.all([
    supabase.from('attendance_logs').select('geofence_status, photo_url, is_manual_entry, status')
      .eq('technician_id', user.id).gte('app_time_in', from).lte('app_time_in', to).order('app_time_in').limit(1).maybeSingle(),
    supabase.from('attendance_corrections').select('created_at, reason, original_time_in, original_time_out, corrected_time_in, corrected_time_out')
      .eq('technician_id', user.id).eq('target_date', date).order('created_at', { ascending: false }),
  ]);
  if (log.error) throw log.error;
  const t = (iso: string | null) => (iso ? fmtTime(Date.parse(iso)) : null);
  return {
    geofence: (log.data?.geofence_status as DayDetails['geofence']) ?? null,
    selfie: !!log.data?.photo_url,
    typedInLater: log.data?.status === 'pending_close',
    corrections: (corr.data ?? []).map((c) => {
      const inChanged = c.original_time_in !== c.corrected_time_in;
      const outChanged = c.original_time_out !== c.corrected_time_out;
      const what = inChanged && outChanged ? 'both' : outChanged ? 'out' : 'in';
      return {
        when: new Date(c.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }),
        reason: c.reason,
        before: what === 'out' ? t(c.original_time_out) : t(c.original_time_in),
        after: what === 'out' ? t(c.corrected_time_out) : t(c.corrected_time_in),
        what,
      };
    }),
  };
}

/** "Ask HR about this day": files a DTR concern ticket HR answers in Tickets (reply shows in the Inbox). */
export async function askHrAboutDay(date: string, dateLabel: string, reason: string, note: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from('tickets').insert({
    employee_id: user.id,
    category: 'DTR Issue',
    title: `DTR check: ${dateLabel}`,
    description: [`Day: ${dateLabel} (${date})`, `What's wrong: ${reason}`, note.trim() ? `Details: ${note.trim()}` : null].filter(Boolean).join('\n'),
    priority: 'medium',
    status: 'open',
  });
  return !error;
}
