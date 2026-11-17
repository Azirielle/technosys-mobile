// Announcements from the office in full (opened from the Inbox), newest first, with who posted them.
import { supabase } from './supabase';

export type Update = { id: string; title: string; content: string; createdAt: string; author: string | null; important: boolean };

export async function getUpdates(): Promise<Update[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, content, created_at, priority, author:profiles!announcements_created_by_fkey ( full_name )')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []).map((a) => {
    const author = (Array.isArray(a.author) ? a.author[0] : a.author) as { full_name?: string } | null;
    return {
      id: a.id, title: a.title ?? '', content: a.content ?? '', createdAt: a.created_at ?? new Date().toISOString(),
      author: author?.full_name ?? null, important: a.priority === 'important' || a.priority === 'urgent', // the Coordinator's pick
    };
  });
}
