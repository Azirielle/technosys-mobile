// The glass time-in card at the top of Home. Three states: not timed in (the clock and a big Time in button),
// working (time since you timed in and a cyan shift bar), done (today's hours). When you time in or out a green
// check plays where the button was. The actual time in/out (GPS, selfie, rules) stays in the Home screen.
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useT } from '../../lib/i18n';
import { Button, Glass, StatusPill, SuccessCheck, Txt, useReducedMotion, useTokens } from '../../ui';

export type ShiftState =
  | { kind: 'off'; shiftStart?: string }
  | { kind: 'working'; startedAt: string; verified: boolean }
  | { kind: 'done'; timeIn: string; timeOut: string | null; hours: number | null };

type Props = { shift: ShiftState; busy?: boolean; onTimeIn: () => void; onTimeOut: () => void };

const SHIFT_MS = 9 * 3600000; // 8 hours of work plus the 1-hour meal break
const clock = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function TimeInCard({ shift, busy, onTimeIn, onTimeOut }: Props) {
  const t = useT();
  const { c, radius } = useTokens();
  const reduced = useReducedMotion();
  const [now, setNow] = useState(() => new Date());
  const [celebrate, setCelebrate] = useState(0);
  const lastKind = useRef(shift.kind);

  useEffect(() => { const id = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (lastKind.current !== shift.kind && shift.kind !== 'off') {
      setCelebrate((n) => n + 1);
      const id = setTimeout(() => setCelebrate(0), 1600);
      lastKind.current = shift.kind;
      return () => clearTimeout(id);
    }
    lastKind.current = shift.kind;
  }, [shift.kind]);

  const workedMs = shift.kind === 'working' ? Math.max(0, now.getTime() - Date.parse(shift.startedAt)) : 0;
  const progress = Math.min(1, workedMs / SHIFT_MS);
  const bar = useAnimatedStyle(() => ({ width: withTiming(`${progress * 100}%`, { duration: reduced ? 0 : 600 }) }), [progress, reduced]);
  const h = Math.floor(workedMs / 3600000), m = Math.floor((workedMs % 3600000) / 60000);
  const start = shift.kind === 'off' && shift.shiftStart ? new Date(shift.shiftStart) : new Date(new Date(now).setHours(8, 0, 0, 0));
  const late = shift.kind === 'off' && now > start;

  const view = shift.kind === 'working'
    ? { tone: 'ok' as const, pill: t('home.working', { time: clock(new Date(shift.startedAt)) }), big: t('home.elapsed', { h, m }),
        sub: shift.verified ? t('home.verified') : t('home.photoOverride') }
    : shift.kind === 'done'
    ? { tone: 'ok' as const, pill: t('home.doneToday'), big: shift.hours != null ? `${shift.hours.toFixed(1)} h` : '—',
        sub: `${clock(new Date(shift.timeIn))} – ${shift.timeOut ? clock(new Date(shift.timeOut)) : '…'} · ${t('home.sentToHr')}` }
    : { tone: late ? 'error' as const : 'pending' as const, pill: t(late ? 'home.notYetLate' : 'home.notYet'), big: clock(now),
        sub: t('home.shiftStarts', { time: clock(start) }) };
  // Not timed in: amber before the start, red once it has started, so it never looks like a switched-off card
  const edge = shift.kind === 'off' ? { borderColor: late ? c.error : c.pending, borderWidth: 2 } : null;

  return (
    <Glass style={[{ padding: 18, gap: 6 }, edge]} radius={radius.card}>
      <StatusPill tone={view.tone} label={view.pill} />
      <Txt variant="display" style={{ fontSize: 40, lineHeight: 48, marginTop: 4 }} accessibilityLiveRegion="polite">{view.big}</Txt>
      <Txt variant="caption" color="ink2">{view.sub}</Txt>
      {shift.kind === 'working' && (
        <View style={{ height: 6, borderRadius: 3, backgroundColor: c.accentSoft, overflow: 'hidden', marginTop: 6 }}>
          <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: c.accent }, bar]} />
        </View>
      )}
      <View style={{ marginTop: 12, minHeight: 56, justifyContent: 'center' }}>
        {celebrate > 0 ? (
          <View style={{ alignItems: 'center' }}><SuccessCheck size={52} playKey={celebrate} /></View>
        ) : shift.kind === 'off' ? (
          <Button icon="log-in" label={t('home.timeIn')} onPress={onTimeIn} loading={busy} />
        ) : shift.kind === 'working' ? (
          <Button kind="secondary" icon="log-out" label={t('home.timeOut')} onPress={onTimeOut} loading={busy} />
        ) : (
          <Button kind="ghost" size="md" icon="plus" label={t('home.timeInAgain')} onPress={onTimeIn} />
        )}
      </View>
    </Glass>
  );
}
