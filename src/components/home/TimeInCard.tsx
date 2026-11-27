// The glass time-in card at the top of Home. Three states: not timed in (the clock and a big Time in button),
// working (time since you timed in and a cyan shift bar), done (today's hours). When you time in or out a green
// check plays where the button was. The actual time in/out (GPS, selfie, rules) stays in the Home screen.
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useT } from '../../lib/i18n';
import { Button, Card, Glass, IconChip, StatusPill, SuccessCheck, Txt, useReducedMotion, useTokens } from '../../ui';
import { openTechyChat } from '../assistant/TechyChatLayer';

export type ShiftState =
  | { kind: 'off'; shiftStart?: string; canCheckInOffice?: boolean }
  | { kind: 'at_office'; checkedInAt: string; clientName?: string }
  | { kind: 'working'; startedAt: string; verified: boolean }
  | { kind: 'done'; timeIn: string; timeOut: string | null; hours: number | null }
  | { kind: 'in_house'; clientName?: string }
  | { kind: 'leave'; leaveType: string };

type Props = { shift: ShiftState; busy?: boolean; onTimeIn: () => void; onTimeOut: () => void; onOfficeCheckIn?: () => void };

const SHIFT_MS = 9 * 3600000; // 8 hours of work plus the 1-hour meal break
const clock = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function TimeInCard({ shift, busy, onTimeIn, onTimeOut, onOfficeCheckIn }: Props) {
  const t = useT();
  const { c, radius } = useTokens();
  const reduced = useReducedMotion();
  const [now, setNow] = useState(() => new Date());
  const [celebrate, setCelebrate] = useState(0);
  const lastKind = useRef(shift.kind);

  // P8: tick every 5 s so the big clock changes within seconds of the phone's (every 30 s it could lag almost a minute)
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 5000); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (lastKind.current !== shift.kind && shift.kind !== 'off' && shift.kind !== 'leave') { // leave loads late: no tick for it
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
  // P5: no job today means nobody expects you, so never "late" (it said late in red next to "No job scheduled")
  const noJob = shift.kind === 'off' && !shift.shiftStart;
  const late = shift.kind === 'off' && !noJob && now > start;

  // No schedule or on leave (Andrew 27 Nov): nothing to time in for, so a small calm card, no clock or empty button space
  if (noJob || shift.kind === 'leave') {
    const leave = shift.kind === 'leave' ? shift : null;
    return (
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconChip icon={leave ? 'sun' : 'calendar'} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="heading">{t(leave ? 'home.onLeavePill' : 'home.noJobPill')}</Txt>
          <Txt variant="caption" color="ink2">{leave ? t('home.onLeaveSub', { type: t(`home.leaveTypes.${leave.leaveType}`) }) : t('home.noJobSub')}</Txt>
        </View>
      </Card>
    );
  }

  const view = shift.kind === 'working'
    ? { tone: 'ok' as const, pill: t('home.working', { time: clock(new Date(shift.startedAt)) }), big: t('home.elapsed', { h, m }),
        sub: shift.verified ? t('home.verified') : t('home.photoOverride') }
    : shift.kind === 'at_office'
    ? { tone: 'ok' as const, pill: t('home.atOfficePill', { time: clock(new Date(shift.checkedInAt)) }), big: clock(now),
        sub: t('home.atOfficeTransitNote') }
    : shift.kind === 'done'
    ? { tone: 'ok' as const, pill: t('home.doneToday'), big: shift.hours != null ? `${shift.hours.toFixed(1)} h` : '—',
        sub: `${clock(new Date(shift.timeIn))} – ${shift.timeOut ? clock(new Date(shift.timeOut)) : '…'} · ${t('home.sentToHr')}` }
    : shift.kind === 'in_house'
    ? { tone: 'pending' as const, pill: t('home.inHousePill'), big: clock(now),
        sub: shift.clientName ? `${shift.clientName} · ${t('home.inHouseSub')}` : t('home.inHouseSub') }
    : { tone: late ? 'error' as const : 'pending' as const, pill: t(late ? 'home.notYetLate' : 'home.notYet'), big: clock(now),
        sub: t('home.shiftStarts', { time: clock(start) }) };
  // Not timed in: amber before the start, red once it has started, so it never looks like a switched-off card
  const edge = shift.kind === 'off' ? { borderColor: late ? c.error : c.pending, borderWidth: 2 } : null;

  return (
    <Glass style={[{ padding: 18, gap: 6 }, edge]} radius={radius.card} tint={c.accentSoft}>
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
        ) : shift.kind === 'in_house' ? (
          <View style={{ gap: 8 }}>
            <Txt variant="caption" color="ink2">{t('home.inHouseNote')}</Txt>
            <Button icon="message-square" label={t('home.inHouseTechy')} onPress={openTechyChat} />
          </View>
        ) : shift.kind === 'at_office' ? (
          <View style={{ gap: 8 }}>
            <Button icon="log-in" label={t('home.timeInManual')} onPress={onTimeIn} loading={busy} />
          </View>
        ) : shift.kind === 'off' ? (
          <View style={{ gap: 8 }}>
            {shift.canCheckInOffice && onOfficeCheckIn && (
              <Button icon="map-pin" label={t('home.checkInOffice')} onPress={onOfficeCheckIn} loading={busy} />
            )}
            <Button
              kind={shift.canCheckInOffice ? 'ghost' : 'primary'}
              icon="log-in"
              label={t('home.timeIn')}
              onPress={onTimeIn}
              loading={busy}
            />
          </View>
        ) : shift.kind === 'working' ? (
          <Button kind="secondary" icon="log-out" label={t('home.timeOut')} onPress={onTimeOut} loading={busy} />
        ) : (
          <Button kind="ghost" size="md" icon="plus" label={t('home.timeInAgain')} onPress={onTimeIn} />
        )}
      </View>
    </Glass>
  );
}
