// assistant: Techy's chat and ticket conversations with HR. Loading, sending, saving Techy's answers, live
// updates, and ending a chat. A Techy chat is saved as a ticket (title AI_CHAT_TITLE) so HR can read it and take over.
import EventSource from 'react-native-sse';
import * as Crypto from 'expo-crypto';
import { supabase, supabaseUrl } from './supabase';

export const AI_CHAT_TITLE = 'Support Conversation';
/** Techy adds this when a form would help; the chat shows ticket shortcuts instead of the code. */
export const FORM_TOKEN = '[ACTION:OPEN_TICKET_FORM]';
const AI_URL = `${supabaseUrl}/functions/v1/chat-support`;

export type Ticket = { id: string; title: string; status: string; handling_mode: string | null; description?: string | null };
export type ChatMessage = { id: string; from: 'me' | 'techy' | 'hr' | 'note'; text: string; pending?: boolean };
type Row = { id: string; sender_role: string | null; content: string; is_internal: boolean | null };

const TICKET_FIELDS = 'id, title, status, handling_mode, description';
const FROM: Record<string, ChatMessage['from']> = { ai: 'techy', admin: 'hr', system: 'note' };
const toMessage = (r: Row): ChatMessage => ({ id: r.id, from: FROM[r.sender_role ?? ''] ?? 'me', text: r.content });

/** Techy answers only in a Techy chat that HR hasn't taken over. */
export const techyAnswers = (t: Ticket | null) => !t || (t.title === AI_CHAT_TITLE && t.handling_mode !== 'ADMIN');

/** The conversation to show: the ticket asked for (from the Inbox), else your unfinished Techy chat, else none yet. */
export async function openConversation(ticketId?: string): Promise<{ ticket: Ticket | null; messages: ChatMessage[] }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ticket: null, messages: [] };
  const query = ticketId
    ? supabase.from('tickets').select(TICKET_FIELDS).eq('id', ticketId)
    : supabase.from('tickets').select(TICKET_FIELDS).eq('employee_id', session.user.id).eq('title', AI_CHAT_TITLE)
        .in('status', ['open', 'in_progress']).order('created_at', { ascending: false }).limit(1);
  const { data: tickets, error } = await query;
  if (error) throw error;
  const ticket = (tickets?.[0] as Ticket | undefined) ?? null;
  if (!ticket) return { ticket: null, messages: [] };

  const { data: rows, error: rowsErr } = await supabase.from('ticket_comments')
    .select('id, sender_role, content, is_internal').eq('ticket_id', ticket.id).order('created_at', { ascending: true });
  if (rowsErr) throw rowsErr;
  const messages = (rows as Row[]).filter((r) => !r.is_internal).map(toMessage);
  // A ticket filed from a form (DTR question, leave…) starts with its description, not a message
  if (!messages.length && ticket.title !== AI_CHAT_TITLE && ticket.description) messages.push({ id: `desc_${ticket.id}`, from: 'me', text: ticket.description });
  return { ticket, messages };
}

/** Starts a new Techy chat (a ticket HR can see) with your first question. */
export async function startChat(firstText: string): Promise<Ticket | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data } = await supabase.from('tickets').insert({
    employee_id: session.user.id, title: AI_CHAT_TITLE, category: 'General Inquiry', description: firstText,
    status: 'open', handling_mode: 'AI', idempotency_key: Crypto.randomUUID(),
  }).select(TICKET_FIELDS).single();
  return (data as Ticket | null) ?? null;
}

async function addMessage(ticketId: string, text: string, role: 'technician' | 'ai'): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase.from('ticket_comments')
    .insert({ ticket_id: ticketId, author_id: session.user.id, content: text, sender_role: role }).select('id').single();
  if (error) console.warn('[assistant] message not saved:', error.message);
  return data?.id ?? null;
}

/** Your message. Returns its id, or null if it couldn't be saved. */
export const sendMine = (ticketId: string, text: string) => addMessage(ticketId, text, 'technician');
/** Techy's finished answer. Null when refused: HR took over while Techy was typing. */
export const saveTechyAnswer = (ticketId: string, text: string) => addMessage(ticketId, text, 'ai');

/** "End": a Techy chat is closed, so the next question starts a new one. HR's tickets stay for HR to finish. */
export async function endConversation(ticket: Ticket | null) {
  if (!ticket || ticket.title !== AI_CHAT_TITLE || ticket.handling_mode === 'ADMIN') return;
  await supabase.from('tickets').update({ status: 'closed' }).eq('id', ticket.id);
}

/** Live: HR taking over or changing the ticket, and new messages (HR replies, saved answers). Returns stop(). */
export function listenToConversation(ticketId: string, onTicket: (t: Ticket) => void, onMessage: (m: ChatMessage) => void) {
  const channel = supabase.channel(`assistant-${ticketId}-${Date.now()}`) // unique: a removed channel finishes later
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `id=eq.${ticketId}` },
      (p) => onTicket(p.new as Ticket))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_comments', filter: `ticket_id=eq.${ticketId}` },
      (p) => { const r = p.new as Row; if (!r.is_internal) onMessage(toMessage(r)); })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

/** Adds a message that arrived live, unless it's already shown (then the shown copy gets the saved id). */
export function mergeMessage(list: ChatMessage[], m: ChatMessage): ChatMessage[] {
  if (list.some((x) => x.id === m.id)) return list;
  const twin = list.findIndex((x) => x.pending && x.from === m.from && x.text.trim() === m.text.trim());
  if (twin === -1) return [...list, m];
  return list.map((x, i) => (i === twin ? m : x));
}

/** Asks Techy (the chat-support function). Streams the answer piece by piece. Returns cancel(). */
export async function askTechy(
  question: string, earlier: ChatMessage[],
  on: { text: (piece: string) => void; done: (full: string) => void; fail: () => void },
): Promise<() => void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { on.fail(); return () => {}; }
  const history = earlier.filter((m) => m.from !== 'note' && !m.pending).slice(-6)
    .map((m) => ({ role: m.from === 'me' ? 'user' : 'assistant', content: m.text }));
  let full = '';
  const es = new EventSource(AI_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: question, history }),
    pollingInterval: 0, // one answer per question: never reconnect
  });
  es.addEventListener('message', (e) => {
    if (!e.data) return;
    const data = JSON.parse(e.data);
    if (data.type === 'text') { full += data.text; on.text(data.text); }
    if (data.type === 'done') { es.close(); on.done(full); }
  });
  es.addEventListener('error', () => { es.close(); if (full) on.done(full); else on.fail(); });
  return () => es.close();
}
