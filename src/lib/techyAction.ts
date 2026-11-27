// techyAction: what Techy offers at the end of an answer (Andrew 27 Nov: only the one thing asked for). Checked by
// scripts/check-techy-action.mjs. [FORM:DTR:2026-11-23] → the DTR form for that day, in the chat · [FORM:OTHER] →
// the "Others" form, in the chat · [GO:LEAVE|TOOLS|TIMEIN|DTR|JOBS] → one button to that screen. Old [ACTION:…] codes
// are only hidden. Lowercase and stray spaces are accepted, so a small slip by the AI still shows the form.
export type TechyAction = { form: 'dtr'; date: string | null } | { form: 'other' } | { go: 'leave' | 'tools' | 'timein' | 'dtr' | 'jobs' };

const ANY_CODE = /\[\s*(?:FORM|GO|ACTION)\s*:[^\]]*\]/gi;
const GO = { LEAVE: 'leave', TOOLS: 'tools', TIMEIN: 'timein', DTR: 'dtr', JOBS: 'jobs' } as const;

export function readAction(text: string): { text: string; action: TechyAction | null } {
  const code = text.match(/\[\s*(FORM|GO)\s*:\s*([A-Za-z_]+)\s*(?::\s*([^\]]*?)\s*)?\]/i); // any day text; only YYYY-MM-DD is used
  const clean = text.replace(ANY_CODE, '').trim();
  if (!code) return { text: clean, action: null };
  const kind = code[1].toUpperCase(), what = code[2].toUpperCase(), date = code[3];
  if (kind === 'FORM' && what === 'DTR') return { text: clean, action: { form: 'dtr', date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null } };
  if (kind === 'FORM' && what === 'OTHER') return { text: clean, action: { form: 'other' } };
  const go = kind === 'GO' ? GO[what as keyof typeof GO] : undefined;
  return { text: clean, action: go ? { go } : null };
}
