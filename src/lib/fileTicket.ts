// fileTicket: files a concern for the office (DTR day, tool problem, accident, vehicle problem…). One concern, one
// ticket (Andrew 27 Nov): if you have an open chat with Techy, THAT chat becomes the concern (its title, kind and
// details change, the chat says "sent", HR answers right there); with no open chat a new ticket is made.
import { supabase } from './supabase';

const refOf = (id: string) => `#${id.slice(0, 8).toUpperCase()}`;

/** Your open chat with Techy (a concern you file becomes it), or null. Forms show its number (prof, 20 Nov). */
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

  const chatId = (await openChat())?.id ?? null;
  if (chatId) {
    // The chat becomes the concern: no second ticket. Its title is no longer Techy's, so HR answers from here on.
    const { error } = await supabase.from('tickets').update({ ...t, status: 'open' }).eq('id', chatId);
    if (error) return null;
    await supabase.from('ticket_comments').insert({ ticket_id: chatId, author_id: user.id, content: sentLine(refOf(chatId)), sender_role: 'technician' });
    return refOf(chatId);
  }

  const { data: created, error } = await supabase.from('tickets')
    .insert({ employee_id: user.id, ...t, status: 'open' }).select('id').single();
  if (error || !created) return null;
  return refOf(created.id);
}
