// A shift from an earlier day that was never timed out. The person says when they left; the time-out is saved
// as 'pending_close' so HR checks it. Only the time-out may be set by a technician (guard_attendance_changes).
import { supabase } from './supabase';
import type { ShiftLog } from './timeIn';

const HOUR = 3600000;
const pad = (n: number) => String(n).padStart(2, '0');
export const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** The oldest open shift that started before today, if any. */
export async function findForgottenShift(userId: string): Promise<ShiftLog | null> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from('attendance_logs')
    .select('id, app_time_in, app_time_out, total_hours, geofence_status, created_at')
    .eq('technician_id', userId)
    .is('app_time_out', null)
    .order('created_at', { ascending: false });
  const stale = (data ?? []).find((l) => Date.parse((l.app_time_in || l.created_at) as string) < startOfDay.getTime());
  return (stale as ShiftLog | undefined) ?? null;
}

/** Quick choices: 5, 6 and 7 PM (work ends at 5 PM). After a late-day time-in: 9, 10 and 11 hours later. */
export function quickChoices(start: Date): { label: string; time: string }[] {
  const at = (h: number) => new Date(new Date(start).setHours(h, 0, 0, 0));
  const choices = start.getHours() < 15 ? [at(17), at(18), at(19)] : [9, 10, 11].map((h) => new Date(start.getTime() + h * HOUR));
  return choices.map((d) => ({ label: d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), time: hhmm(d) }));
}

export type LeftAtPreview = { leftAt: Date; atWork: number; lunch: number; counted: number; valid: boolean; veryLong: boolean };

/** What "I left at HH:MM" means: the time-out (next day if it's earlier than the time-in) and the hours. */
export function previewLeftAt(start: Date, time: string): LeftAtPreview {
  const [h, m] = time.split(':').map((x) => parseInt(x, 10));
  const out = new Date(start);
  out.setHours(h || 0, m || 0, 0, 0);
  let outMs = out.getTime();
  if (outMs <= start.getTime()) outMs += 24 * HOUR;
  const atWork = (outMs - start.getTime()) / HOUR;
  const lunch = atWork > 5 ? 1 : 0;
  return {
    leftAt: new Date(outMs),
    atWork: Math.round(atWork * 10) / 10,
    lunch,
    counted: Math.round(Math.max(0, atWork - lunch) * 10) / 10,
    valid: atWork > 0 && atWork <= 24,
    veryLong: atWork > 16,
  };
}

/** Saves "I left at …" for HR to check, and takes the person off the live map. */
export async function closeForgottenShift(me: { id: string; full_name?: string | null }, log: ShiftLog, time: string): Promise<{ hours: number } | null> {
  const p = previewLeftAt(new Date(log.app_time_in), time);
  if (!p.valid) return null;
  const outIso = p.leftAt.toISOString();
  const { error } = await supabase
    .from('attendance_logs')
    .update({ app_time_out: outIso, total_hours: p.counted, status: 'pending_close' })
    .eq('id', log.id);
  if (error) return null;
  await supabase.from('live_locations').update({ status: 'offline', updated_at: outIso }).eq('technician_id', me.id);
  return { hours: p.counted };
}
