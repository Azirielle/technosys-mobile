// Plain words for a job's time and for what the office changed ("Moved from Wed, Nov 18", "Cancelled"…).
import type { Job, JobChange } from '../../lib/jobs';
import type { Tone } from '../../ui';

type T = (key: string, vars?: Record<string, string | number>) => string;

export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const dateOf = (iso: string) => new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
export const timeRange = (job: Job) => (job.end_time ? `${timeOf(job.start_time)} – ${timeOf(job.end_time)}` : timeOf(job.start_time));

/** "Just now", "3 h ago", "Yesterday", "Nov 12" */
export function ago(iso: string, t: T) {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 2) return t('jobs.justNow');
  if (mins < 60) return t('jobs.minAgo', { n: mins });
  if (mins < 24 * 60) return t('jobs.hoursAgo', { n: Math.round(mins / 60) });
  if (mins < 48 * 60) return t('jobs.yesterday');
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export const CHANGE_ICON = { moved: 'repeat', cancelled: 'x-circle', added: 'plus-circle', crew: 'user-plus' } as const;

/** The short badge on a job card. */
export function changeBadge(ch: JobChange, t: T): { tone: Tone; label: string } {
  if (ch.kind === 'moved') return { tone: 'pending', label: ch.from ? t('jobs.movedFrom', { date: dateOf(ch.from) }) : t('jobs.moved') };
  if (ch.kind === 'cancelled') return { tone: 'error', label: t('jobs.cancelled') };
  if (ch.kind === 'crew') return { tone: 'info', label: t('jobs.crewAdded') };
  return { tone: 'info', label: t('jobs.added', { when: ago(ch.at, t) }) };
}

/** The full sentence in the "What changed" list. */
export function changeSentence(ch: JobChange, t: T) {
  if (ch.kind === 'moved') return ch.to ? t('jobs.movedTo', { date: dateOf(ch.to), time: timeOf(ch.to) }) : t('jobs.moved');
  if (ch.kind === 'cancelled') return t('jobs.cancelledLine');
  if (ch.kind === 'crew') return t('jobs.crewJoined', { name: ch.crew ?? '' });
  return t('jobs.addedLine');
}
