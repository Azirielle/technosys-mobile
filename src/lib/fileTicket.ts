// fileTicket: files a concern for the office (tool problem, accident, vehicle problem…). If you have an open chat
// with Techy, the new ticket is linked to it and the chat says "sent (ticket #…)", so it's one conversation (M2).
import { supabase } from './supabase';

const refOf = (id: string) => `#${id.slice(0, 8).toUpperCase()}`;

/** Your open chat with Techy (a new ticket joins it), or null. Forms show its number (prof, 20 Nov). */
export async function openChat(): Promise<{ id: string; ref: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('tickets')
    .select('id').eq('employee_id', user.id).eq('title', 'Support Conversation')
    .in('status', ['open', 'in_progress']).order('created_at', { ascending: false }).limit(1);
  return data?.[0] ? { id: data[0].id, ref: refOf(data[0].id) } : null;
}

export type NewTicket = { category: string; title: string; description: string; priority: 'low' | 'medium' | 'high' | 'urgent' };

/** The ticket's number ("#3F2A91C0"), or null when it couldn't be sent. `sentLine(ref)` is the line posted in the chat. */
export async function fileTicket(t: NewTicket, sentLine: (ref: string) => string): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const parentId = (await openChat())?.id ?? null;

  const { data: created, error } = await supabase.from('tickets')
    .insert({ employee_id: user.id, ...t, status: 'open', from_ticket_id: parentId }).select('id').single();
  if (error || !created) return null;

  const ref = refOf(created.id);
  if (parentId) {
    await supabase.from('ticket_comments').insert({ ticket_id: parentId, author_id: user.id, content: sentLine(ref), sender_role: 'technician' });
  }
  return ref;
}
