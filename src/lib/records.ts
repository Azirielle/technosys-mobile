// My records (prof, 20 Nov: "iba ang inbox sa history"): everything you filed, newest first, with its ticket number,
// so you can trace a request: DTR concerns, tool problems and requests, other reports, and leaves. Plain chats with
// Techy aren't listed (they're in Techy's chat).
import { supabase } from './supabase';

export type MyRecord = {
  id: string;
  kind: 'dtr' | 'tool' | 'other' | 'leave';
  title: string;
  ref: string | null;     // "#3F2A91C0" for tickets
  status: string;         // open / in_progress / resolved / closed, or pending / approved / rejected for leaves
  at: string;
  ticketId: string | null;
};

const kindOf = (category: string): MyRecord['kind'] => (/dtr/i.test(category) ? 'dtr' : /tool|equipment/i.test(category) ? 'tool' : 'other');

export async function getMyRecords(): Promise<MyRecord[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const [tickets, leaves] = await Promise.all([
    supabase.from('tickets').select('id, title, category, status, created_at').eq('employee_id', user.id)
      .neq('title', 'Support Conversation').order('created_at', { ascending: false }).limit(60),
    supabase.from('leaves').select('id, leave_type, start_date, status, created_at').eq('technician_id', user.id)
      .order('created_at', { ascending: false }).limit(30),
  ]);
  if (tickets.error) throw tickets.error;
  if (leaves.error) throw leaves.error;
  const list: MyRecord[] = [
    ...(tickets.data ?? []).map((x) => ({ id: x.id, kind: kindOf(x.category), title: x.title, ref: `#${x.id.slice(0, 8).toUpperCase()}`,
      status: x.status ?? 'open', at: x.created_at as string, ticketId: x.id })),
    ...(leaves.data ?? []).map((x) => ({ id: x.id, kind: 'leave' as const, title: x.leave_type, ref: null, status: x.status,
      at: (x.created_at ?? x.start_date) as string, ticketId: null })),
  ];
  return list.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
