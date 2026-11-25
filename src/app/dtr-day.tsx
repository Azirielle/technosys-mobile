// One DTR day, opened from the DTR tab: your times, where you timed in, how the hours were counted (time at work,
// meal break, late, overtime, night shift), the job, any change HR made, and "Ask HR about this day".
import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useT } from '../lib/i18n';
import { DayDetails, DtrDay, cutoffFor, dayLabel, getCachedDay, getDayDetails, getMyDtr } from '../lib/dtr';
import WorkTag from '../components/jobs/WorkTag';
import DayLine from '../components/dtr/DayLine';
import { dayTags, n1 } from '../components/dtr/dayTags';
import { BackHeader, Button, Card, Notice, SectionLabel, SkeletonRow, StatusText, Txt, useTokens } from '../ui';

const TYPE_TO_ASSIGNMENT = { onSite: 'on_site', outOfTown: 'deployment', officeHq: 'office_duty', inHouse: 'in_house' } as const;
type T = ReturnType<typeof useT>;

/** The "How your hours were counted" lines, top to bottom, ending with the counted total. */
function countedLines(day: DtrDay, t: T) {
  if (!day.timeOut) return [];
  const gross = day.mealTaken ? day.hours + 1 : day.hours;
  const lines: React.ReactNode[] = [<DayLine key="g" label={t('dtr.timeAtWork')} value={`${n1(gross)} h`} />];
  if (day.mealTaken) lines.push(<DayLine key="m" label={t('dtr.mealBreak')} value="−1.0 h" note={t('dtr.whyMeal')} />);
  if (day.lateMin) lines.push(<DayLine key="l" label={t('dtr.lateBy')} value={t('dtr.minutes', { n: day.lateMin })} note={t('dtr.whyLate', { time: day.expectedStart ?? '8:00 AM' })} />);
  if (day.ot) lines.push(<DayLine key="o" label={t('dtr.overtimeApproved')} value={`${n1(day.ot)} h`} note={t('dtr.whyOt', { n: n1(day.ot) })} />);
  if (day.unapprovedOt >= 0.1) lines.push(<DayLine key="u" label={t('dtr.otNotApprovedLine')} value={`${n1(day.unapprovedOt)} h`} note={t('dtr.whyUnapproved', { n: n1(day.unapprovedOt) })} />);
  if (day.restDayOt) lines.push(<DayLine key="r" label={t('dtr.restDayLine')} value={`${n1(day.restDayOt)} h`} note={t('dtr.whyRestDay')} />);
  if (day.night >= 0.1) lines.push(<DayLine key="n" label={t('dtr.nightShift')} value={`${n1(day.night)} h`} note={t('dtr.whyNight')} />);
  lines.push(<DayLine key="t" label={t('dtr.countedLine')} value={`${n1(day.hours)} h`} strong last />);
  return lines;
}

const plainWords = (day: DtrDay, t: T) => ({
  absent: t('dtr.whyAbsent'), open: t('dtr.whyOpen'), checking: t('dtr.whyChecking'), working: t('dtr.whyWorking'),
  leave: t('dtr.whyLeave', { type: day.leaveType ?? '' }), holiday: t('dtr.whyHoliday'), worked: null,
}[day.state]);

export default function DtrDayScreen() {
  const t = useT();
  const router = useRouter();
  const { c, space } = useTokens();
  const { date } = useLocalSearchParams<{ date: string }>();
  const [day, setDay] = useState<DtrDay | undefined>(() => (date ? getCachedDay(date) : undefined));
  const [missing, setMissing] = useState(false);
  const [details, setDetails] = useState<DayDetails | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!date) return;
    getDayDetails(date).then(setDetails).catch(() => setFailed(true));
    // Opened from Home before the DTR tab loaded: work out that day's cut-off first
    if (!getCachedDay(date)) getMyDtr(cutoffFor(date)).then(() => { const d = getCachedDay(date); if (d) setDay(d); else setMissing(true); }).catch(() => setMissing(true));
  }, [date]);

  if (!day || !date) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={['top', 'bottom']}>
        <BackHeader label={t('common.back')} />
        <View style={{ padding: space.lg }}>
          {missing || !date ? <Notice tone="info" text={t('dtr.dayMissing')} /> : <Card padded={false}><SkeletonRow /><SkeletonRow /></Card>}
        </View>
      </SafeAreaView>
    );
  }

  const tags = dayTags(day, t);
  const counted = countedLines(day, t);
  const plain = plainWords(day, t);
  const where = details?.geofence === 'inside' ? t('dtr.atSite') : details?.geofence === 'outside' ? t('dtr.outsideSite') : null;
  const timeInNote = [where, details?.selfie ? t('dtr.selfieTaken') : null].filter(Boolean).join(' · ');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={['top', 'bottom']}>
      <BackHeader label={t('common.back')} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 40 }}>
        <Animated.View>
          <Txt variant="title" accessibilityRole="header">{dayLabel(date, true)}</Txt>
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
            {tags.length ? tags.map((x) => <StatusText key={x.key} tone={x.tone} label={x.label} />) : <StatusText tone="ok" label={t('dtr.allGood')} />}
          </View>
          {!!plain && <Txt variant="body" color="ink2" style={{ marginTop: 10 }}>{plain}</Txt>}

          {!!day.timeIn && (
            <>
              <SectionLabel>{t('dtr.yourTime')}</SectionLabel>
              <Card padded={false}>
                <DayLine label={t('dtr.timeIn')} value={day.timeIn} note={timeInNote || undefined} />
                <DayLine label={t('dtr.timeOut')} value={day.timeOut ?? (day.state === 'working' ? '…' : t('dtr.noTimeOut'))} last />
              </Card>
            </>
          )}

          {counted.length > 0 && (<><SectionLabel>{t('dtr.howCounted')}</SectionLabel><Card padded={false}>{counted}</Card></>)}

          {(!!day.jobName || !!day.workType) && (
            <>
              <SectionLabel>{t('dtr.job')}</SectionLabel>
              <Card style={{ gap: 6 }}>
                {!!day.jobName && <Txt variant="heading">{day.jobName}</Txt>}
                {day.workType && <WorkTag assignmentType={TYPE_TO_ASSIGNMENT[day.workType]} />}
              </Card>
            </>
          )}

          <SectionLabel>{t('dtr.hrChanges')}</SectionLabel>
          {failed ? <Notice tone="error" text={t('common.noSignal')} />
            : !details ? <Card padded={false}><SkeletonRow /></Card>
            : details.corrections.length === 0 ? <Txt variant="body" color="ink2">{t('dtr.noChanges')}</Txt>
            : <Card padded={false}>{details.corrections.map((x, i) => (
                <DayLine key={i} label={t(`dtr.changed_${x.what}`)} value={x.after ?? '—'} last={i === details.corrections.length - 1}
                  note={[x.when, x.before ? t('dtr.wasTime', { time: x.before }) : null, x.reason].filter(Boolean).join(' · ')} />
              ))}</Card>}

          <View style={{ marginTop: 24, gap: 8 }}>
            <Button kind="secondary" icon="message-circle" label={t('dtr.askHr')} onPress={() => router.push(`/dtr-ask?date=${date}` as Href)} />
            <Txt variant="caption" color="ink2" style={{ textAlign: 'center' }}>{t('dtr.askHrSub')}</Txt>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
