// The Inbox: every answer from HR (replies on your tickets, leave approved / declined) and the office's
// announcements, newest first. Which ones you've
// opened is remembered on this phone. HR replies also show as a phone notification while the app is open.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { getNotifications } from './notifications';
import { sanitizeNotification } from '../utils/notification-sanitizer';

export type InboxItem = {
  id: string;
  kind: 'reply' | 'leave' | 'warning' | 'announcement';
  title: string;
  text: string;
  at: string;
  read: boolean;
  ticketId?: string;
  /** 'Approved' / 'Refused' when HR decided a request */
  decision?: string;
  /** Announcement the office marked Important or Urgent */
  important?: boolean;
  /** Leave decisions: the screen words the title as "Sick leave · Nov 20" */
  leave?: { type: string; date: string };
};

const readKey = (userId: string) => `READ_NOTIFS_${userId}`;

// Told when items are marked read, so the Inbox tab's count drops right away
const readListeners = new Set<() => void>();
export function onInboxRead(cb: () => void): () => void { readListeners.add(cb); return () => { readListeners.delete(cb); }; }

async function readIds(userId: string): Promise<Set<string>> {
  try { return new Set(JSON.parse((await AsyncStorage.getItem(readKey(userId))) ?? '[]')); } catch { return new Set(); }
}

export async function getInbox(): Promise<InboxItem[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const read = await readIds(user.id);
  const items: InboxItem[] = [];

  const { data: tickets } = await supabase
    .from('tickets').select('id, title, category').eq('employee_id', user.id)
    .order('updated_at', { ascending: false }).limit(10);
  if (tickets?.length) {
    const { data: replies } = await supabase
      .from('ticket_comments').select('id, ticket_id, content, created_at')
      .in('ticket_id', tickets.map((t) => t.id)).in('sender_role', ['admin', 'system']).eq('is_internal', false)
      .order('created_at', { ascending: false }).limit(20);
    const shown = new Set<string>(); // one row per ticket: its newest HR message (a new reply makes it unread again)
    for (const r of replies ?? []) {
      if (shown.has(r.ticket_id)) continue;
      shown.add(r.ticket_id);
      const ticket = tickets.find((t) => t.id === r.ticket_id);
      const approved = r.content.includes('[DECISION: APPROVED');
      const refused = r.content.includes('[DECISION: REFUSED');
      const rawTitle = approved ? `Ticket Approved (${ticket?.category || 'HR'})` : refused ? `Ticket Refused (${ticket?.category || 'HR'})` : `HR Message: ${ticket?.title || ticket?.category || 'Support'}`;
      const p = sanitizeNotification(rawTitle, r.content, approved ? 'hr' : refused ? 'help' : 'admin', ticket?.category ?? undefined);
      const id = `tc_${r.id}`;
      items.push({ id, kind: 'reply', title: p.title, text: p.summary, at: r.created_at as string, read: read.has(id), ticketId: r.ticket_id, decision: p.statusTag });
    }
  }

  // Leave HR decided in the last 14 days (the one still waiting stays on Home's "Needs your attention")
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const { data: leaves } = await supabase.from('leaves').select('id, leave_type, start_date, status, rejection_reason, updated_at')
    .eq('technician_id', user.id).in('status', ['approved', 'rejected']).gte('updated_at', since)
    .order('updated_at', { ascending: false }).limit(10);
  for (const l of leaves ?? []) {
    const id = `lv_${l.id}_${l.status}`;
    const date = new Date(`${l.start_date.slice(0, 10)}T00:00:00Z`).toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' });
    items.push({ id, kind: 'leave', title: '', text: l.rejection_reason ?? '', at: (l.updated_at ?? l.start_date) as string, read: read.has(id),
      decision: l.status === 'approved' ? 'Approved' : 'Refused', leave: { type: l.leave_type, date } });
  }

  // Written warnings HR recorded in your 201 file (the notice: tap shows the details)
  const { data: warnings } = await supabase.from('employee_warnings').select('id, subject, details, created_at')
    .eq('employee_id', user.id).order('created_at', { ascending: false }).limit(10);
  for (const w of warnings ?? []) {
    const id = `wr_${w.id}`;
    items.push({ id, kind: 'warning', title: w.subject, text: w.details ?? '', at: w.created_at as string, read: read.has(id) });
  }

  const { data: news } = await supabase.from('announcements').select('id, title, content, created_at, priority').order('created_at', { ascending: false }).limit(10);
  for (const a of news ?? []) {
    const p = sanitizeNotification(a.title, a.content || '', 'admin', 'Announcement');
    const id = `ann_${a.id}`;
    items.push({ id, kind: 'announcement', title: p.title, text: p.summary, at: a.created_at as string, read: read.has(id), important: a.priority === 'important' || a.priority === 'urgent' });
  }
  return items.sort((x, y) => Date.parse(y.at) - Date.parse(x.at));
}

export async function countUnread(): Promise<number> {
  return (await getInbox()).filter((i) => !i.read).length;
}

export async function markRead(ids: string[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const read = await readIds(user.id);
  ids.forEach((id) => read.add(id));
  await AsyncStorage.setItem(readKey(user.id), JSON.stringify([...read])).catch(() => {});
  readListeners.forEach((cb) => cb());
}

/** Calls `onChange` when HR replies, a ticket changes or an announcement is posted. Returns the unsubscribe. */
export function watchInbox(onChange: () => void): () => void {
  const channel = supabase
    .channel(`inbox-${Date.now()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_comments' }, (payload: { new?: { sender_role?: string; content?: string; ticket_id?: string } }) => {
      const reply = payload.new;
      if (reply?.sender_role !== 'admin' && reply?.sender_role !== 'system') return;
      onChange();
      try {
        // Not available in Expo Go on Android (see lib/notifications); skipped there.
        getNotifications()?.scheduleNotificationAsync({
          content: { title: 'TechnoCycle HR', body: (reply.content || '').replace(/\[DECISION:.*?\]\s*/i, '').slice(0, 100), data: { ticketId: reply.ticket_id } },
          trigger: null,
        });
      } catch {
        // no phone notification: the Inbox still shows it
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets' }, () => onChange())
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leaves' }, () => onChange())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, () => onChange())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
