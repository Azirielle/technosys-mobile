// fileTicket: files a concern for the office (DTR day, tool problem, accident, vehicle problem…). One concern, one
// ticket (Andrew 27 Nov): if you have an open chat with Techy, THAT chat becomes the concern (its title, kind and
// details change) and Techy confirms it in the chat ("sent, wait for HR"); with no open chat a new ticket is made.
// An optional photo is uploaded first and attached to the ticket, so HR sees it on the concern card.
import { supabase } from './supabase';
import { uploadPhoto } from './photoUpload';

const refOf = (id: string) => `#${id.slice(0, 8).toUpperCase()}`;
const BUCKET = 'ticket_attachments';

/** Your open chat with Techy (a concern you file becomes it), or null. Forms show its number (prof, 20 Nov). */
export async function openChat(): Promise<{ id: string; ref: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('tickets')
    .select('id').eq('employee_id', user.id).eq('title', 'Support Conversation')
    .in('status', ['open', 'in_progress'])
    .or('handling_mode.is.null,handling_mode.neq.ADMIN') // a chat HR took over can't become a concern (the database refuses)
    .order('created_at', { ascending: false }).limit(1);
  return data?.[0] ? { id: data[0].id, ref: refOf(data[0].id) } : null;
}

export type NewTicket = { category: string; title: string; description: string; priority: 'low' | 'medium' | 'high' | 'urgent' };

/** The ticket's number ("#3F2A91C0"), or null when it couldn't be sent. `techyLine(ref)` is Techy's confirmation in the
 *  chat (what was sent + "wait for HR"); `photoUri` is an optional photo from PhotoPicker. */
export async function fileTicket(t: NewTicket, techyLine: (ref: string) => string, photoUri?: string | null): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  let photo: { attachment_url: string; attachment_type: string } | null = null;
  if (photoUri) {
    const path = `${user.id}/${Date.now()}.jpg`;
    try { await uploadPhoto(BUCKET, path, photoUri); } catch { return null; } // no photo, no half a concern: try again
    photo = { attachment_url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, attachment_type: 'image/jpeg' };
  }
  const row = { ...t, ...(photo ?? {}), status: 'open' };

  const chatId = (await openChat())?.id ?? null;
  if (chatId) {
    // The chat becomes the concern: no second ticket. Its title is no longer Techy's, so HR answers from here on.
    const { error } = await supabase.from('tickets').update(row).eq('id', chatId);
    if (error) return null;
    await supabase.from('ticket_comments').insert({ ticket_id: chatId, author_id: user.id, content: techyLine(refOf(chatId)), sender_role: 'ai' });
    return refOf(chatId);
  }

  const { data: created, error } = await supabase.from('tickets').insert({ employee_id: user.id, ...row }).select('id').single();
  if (error || !created) return null;
  return refOf(created.id);
}
