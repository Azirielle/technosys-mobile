// What Home shows besides the time-in card and today's job: "Needs your attention" (leave waiting for HR or
// not approved, policies to read, shifts HR is checking) and how many tools you have with you.
import { supabase } from './supabase';
import { countPoliciesToRead } from './profile';

export type AttentionItem = {
  key: string;
  kind: 'leave' | 'policy' | 'shift';
  title: string;           // already in plain words or a translation key + vars, see `vars`
  vars?: Record<string, string | number>;
  status: 'waiting' | 'notApproved' | 'toRead' | 'checking';
  date?: string;           // YYYY-MM-DD, for shifts (opens that DTR day)
};
export type HomeSummary = { attention: AttentionItem[]; toolsWithYou: number };

const shortDate = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' });
const manilaYmd = (iso: string) => new Date(Date.parse(iso) + 8 * 3600000).toISOString().slice(0, 10);

export async function getHomeSummary(): Promise<HomeSummary> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { attention: [], toolsWithYou: 0 };
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const [leaves, tools, shifts, toRead] = await Promise.all([
    supabase.from('leaves').select('id, leave_type, start_date, status, updated_at').eq('technician_id', user.id)
      .or(`status.eq.pending,and(status.eq.rejected,updated_at.gte.${weekAgo})`).order('start_date').limit(5),
    supabase.from('tool_borrowings').select('id', { count: 'exact', head: true }).eq('technician_id', user.id).eq('status', 'checked_out'),
    supabase.from('attendance_logs').select('id, app_time_in').eq('technician_id', user.id).eq('status', 'pending_close')
      .order('app_time_in', { ascending: false }).limit(3),
    countPoliciesToRead(user.id).catch(() => 0),
  ]);

  const attention: AttentionItem[] = [];
  for (const l of leaves.data ?? []) {
    attention.push({
      key: `leave-${l.id}`, kind: 'leave', title: 'home.leaveItem',
      vars: { type: l.leave_type, date: shortDate(l.start_date) },
      status: l.status === 'rejected' ? 'notApproved' : 'waiting',
    });
  }
  for (const s of shifts.data ?? []) {
    if (!s.app_time_in) continue;
    const date = manilaYmd(s.app_time_in);
    attention.push({ key: `shift-${s.id}`, kind: 'shift', title: 'home.shiftItem', vars: { date: shortDate(date) }, status: 'checking', date });
  }
  if (toRead > 0) attention.push({ key: 'policies', kind: 'policy', title: 'home.policyItem', vars: { n: toRead }, status: 'toRead' });
  return { attention, toolsWithYou: tools.count ?? 0 };
}
