// The status words for one DTR day (late, absent, HR checking, OT…), shared by the day list and the day screen.
import type { DtrDay } from '../../lib/dtr';
import type { Tone } from '../../ui';

export type DayTag = { key: string; tone: Tone; label: string };
type T = (key: string, vars?: Record<string, string | number>) => string;
export const n1 = (x: number) => (Math.round(x * 10) / 10).toFixed(1);

export function dayTags(day: DtrDay, t: T): DayTag[] {
  const tags: DayTag[] = [];
  if (day.state === 'open' || day.state === 'checking') tags.push({ key: 'chk', tone: 'pending', label: t('dtr.hrChecking') });
  if (day.state === 'working') tags.push({ key: 'w', tone: 'ok', label: t('dtr.working') });
  if (day.state === 'absent') tags.push({ key: 'a', tone: 'error', label: t('dtr.absent') });
  if (day.state === 'leave') tags.push({ key: 'l', tone: 'info', label: t('dtr.onLeave') });
  if (day.state === 'holiday') tags.push({ key: 'h', tone: 'info', label: day.holidayName || t('dtr.holiday') });
  if (day.lateMin) tags.push({ key: 'late', tone: 'error', label: t('dtr.late', { n: day.lateMin }) });
  if (day.ot) tags.push({ key: 'ot', tone: 'info', label: t('dtr.ot', { n: n1(day.ot) }) });
  if (day.restDayOt) tags.push({ key: 'rd', tone: 'info', label: t('dtr.restDay', { n: n1(day.restDayOt) }) });
  if (day.unapprovedOt >= 0.1) tags.push({ key: 'un', tone: 'pending', label: t('dtr.otNotApproved', { n: n1(day.unapprovedOt) }) });
  return tags;
}

/** Days worth a second look: late, absent, no time-out, HR checking, or overtime nobody approved. */
export const needsALook = (d: DtrDay) =>
  d.lateMin > 0 || d.state === 'absent' || d.state === 'open' || d.state === 'checking' || d.unapprovedOt >= 0.1;
