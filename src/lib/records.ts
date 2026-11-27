// My records (prof, 20 Nov: "iba ang inbox sa history"; Andrew 28 Nov: "my overall activity"): everything you did in
// the app, newest first: time in and time out, arriving at a site and finishing a job, what you filed (DTR concerns,
// tool problems and requests, other reports, leaves, overtime, a new phone) and the tools you borrowed and returned.
// Plain chats with Techy aren't listed (they're in Techy's chat).
import { supabase } from './supabase';

export type RecordKind =
  | 'time_in' | 'time_out' | 'arrived' | 'finished'          // work
  | 'dtr' | 'tool' | 'other' | 'leave' | 'overtime' | 'phone' // filed
  | 'borrowed' | 'returned';                                 // tools
export type RecordGroup = 'work' | 'filed' | 'tools';

export type MyRecord = {
  id: string;
  kind: RecordKind;
  title: string;          // client, ticket title, tool name, leave type, phone name, or hours for overtime
  ref: string | null;     // "#3F2A91C0" for tickets
  status: string | null;  // open / in_progress / resolved / closed, pending / approved / rejected, late, needs_review, damaged, lost
  minutes: number | null; // minutes late (time in) or hours (time out)
  at: string;
  href: string | null;    // where tapping it goes
};

export const GROUP: Record<RecordKind, RecordGroup> = {
  time_in: 'work', time_out: 'work', arrived: 'work', finished: 'work',
  dtr: 'filed', tool: 'filed', other: 'filed', leave: 'filed', overtime: 'filed', phone: 'filed',
  borrowed: 'tools', returned: 'tools',
};

const kindOf = (category: string): RecordKind => (/dtr/i.test(category) ? 'dtr' : /tool|equipment/i.test(category) ? 'tool' : 'other');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const one = (x: any) => (Array.isArray(x) ? x[0] : x);

export async function getMyRecords(): Promise<MyRecord[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const me = user.id;
  const [tickets, leaves, days, tools, events, overtime, phones] = await Promise.all([
    supabase.from('tickets').select('id, title, category, status, created_at').eq('employee_id', me)
      .neq('title', 'Support Conversation').order('created_at', { ascending: false }).limit(60),
    supabase.from('leaves').select('id, leave_type, start_date, status, created_at').eq('technician_id', me)
      .order('created_at', { ascending: false }).limit(30),
    supabase.from('work_days').select('id, work_date, time_in, time_out, hours, late_minutes, status, place_name, job:jobs ( client_name )')
      .eq('person_id', me).order('time_in', { ascending: false }).limit(30),
    supabase.from('tool_borrowings').select('id, status, handed_over_at, returned_at, tool:tools ( name )').eq('technician_id', me)
      .order('handed_over_at', { ascending: false }).limit(30),
    supabase.from('job_events').select('id, kind, at, job:jobs ( client_name )').eq('person_id', me).in('kind', ['arrived', 'finished', 'done'])
      .order('at', { ascending: false }).limit(30),
    supabase.from('overtime_requests').select('id, requested_hours, status, created_at').eq('technician_id', me)
      .order('created_at', { ascending: false }).limit(20),
    supabase.from('device_change_requests').select('id, device_name, status, requested_at').eq('profile_id', me)
      .order('requested_at', { ascending: false }).limit(10),
  ]);
  for (const r of [tickets, leaves, days, tools, events, overtime, phones]) if (r.error) throw r.error;

  const list: MyRecord[] = [];
  const add = (r: Omit<MyRecord, 'ref' | 'minutes' | 'href'> & Partial<MyRecord>) => list.push({ ref: null, minutes: null, href: null, ...r });
  for (const x of tickets.data ?? []) {
    add({ id: x.id, kind: kindOf(x.category), title: x.title, ref: `#${x.id.slice(0, 8).toUpperCase()}`, status: x.status ?? 'open',
      at: x.created_at as string, href: `/ticket/${x.id}` });
  }
  for (const x of leaves.data ?? []) {
    add({ id: x.id, kind: 'leave', title: x.leave_type, status: x.status, at: (x.created_at ?? x.start_date) as string, href: '/leave' });
  }
  for (const x of days.data ?? []) {
    const where = one(x.job)?.client_name ?? x.place_name ?? '';
    const day = `/dtr-day?date=${x.work_date}`;
    add({ id: `${x.id}-in`, kind: 'time_in', title: where, status: x.late_minutes > 0 ? 'late' : null, minutes: x.late_minutes || null, at: x.time_in, href: day });
    if (x.time_out) {
      add({ id: `${x.id}-out`, kind: 'time_out', title: where, status: x.status === 'needs_review' ? 'needs_review' : null,
        minutes: x.hours != null ? Number(x.hours) : null, at: x.time_out, href: day });
    }
  }
  for (const x of tools.data ?? []) {
    const name = one(x.tool)?.name ?? '';
    if (x.handed_over_at) add({ id: `${x.id}-out`, kind: 'borrowed', title: name, status: null, at: x.handed_over_at, href: '/tools' });
    if (x.returned_at) {
      add({ id: `${x.id}-back`, kind: 'returned', title: name, status: x.status === 'damaged' || x.status === 'lost' ? x.status : null, at: x.returned_at, href: '/tools' });
    }
  }
  for (const x of events.data ?? []) {
    add({ id: x.id, kind: x.kind === 'arrived' ? 'arrived' : 'finished', title: one(x.job)?.client_name ?? '', status: null, at: x.at });
  }
  for (const x of overtime.data ?? []) {
    add({ id: x.id, kind: 'overtime', title: String(x.requested_hours ?? ''), status: x.status, at: x.created_at as string, href: '/dtr' });
  }
  for (const x of phones.data ?? []) {
    add({ id: x.id, kind: 'phone', title: x.device_name ?? '', status: x.status, at: x.requested_at as string });
  }
  return list.filter((r) => !!r.at).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
