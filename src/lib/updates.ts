// Updates from the office: the company announcements, newest first, with who posted them.
import { supabase } from './supabase';

export type Update = { id: string; title: string; content: string; createdAt: string; author: string | null; important: boolean };

const IMPORTANT = ['urgent', 'important', 'required', 'critical', 'mahalaga'];

export async function getUpdates(): Promise<Update[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, content, created_at, author:profiles!announcements_created_by_fkey ( full_name )')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []).map((a) => {
    const author = (Array.isArray(a.author) ? a.author[0] : a.author) as { full_name?: string } | null;
    const text = `${a.title ?? ''} ${a.content ?? ''}`.toLowerCase();
    return {
      id: a.id, title: a.title ?? '', content: a.content ?? '', createdAt: a.created_at ?? new Date().toISOString(),
      author: author?.full_name ?? null, important: IMPORTANT.some((w) => text.includes(w)),
    };
  });
}
