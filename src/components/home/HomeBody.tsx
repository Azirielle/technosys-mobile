// Home, top to bottom by importance: date → time-in card → today's job → three shortcuts (My tools, Leave, DTR)
// → needs your attention. Everything arrives together. Time in/out comes from the Home screen; this file arranges
// what you see. Details, My tools, Leave and DTR open as full screens (slide in); the Inbox is its own tab.
import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter, type Href } from 'expo-router';
import { useFocusRefresh } from '../../lib/useFocusRefresh';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '../../lib/i18n';
import { getHomeSummary, AttentionItem, HomeSummary } from '../../lib/homeSummary';
import { manilaDay, type Job } from '../../lib/jobs';
import { Card, ListRow, SectionLabel, TAB_BAR_HEIGHT, arrive, tourTarget, useReducedMotion, useTokens } from '../../ui';
import { dateOf } from '../jobs/jobWords';
import HomeHeader from './HomeHeader';
import OfflineBanner from '../OfflineBanner';
import { useOnline } from '../../lib/online';
import TimeInCard, { ShiftState } from './TimeInCard';
import TodayJob, { type Trip } from './TodayJob';
import QuickActions from './QuickActions';
import AttentionList from './AttentionList';

type Props = {
  shift: ShiftState;
  busy: boolean;
  job: Job | null;
  onTimeIn: () => void;
  onTimeOut: () => void;
  onOfficeCheckIn?: () => void;
  onRefresh: () => Promise<void>;
  /** Shown under today's job (Work v2: Arrived / Done / Ask for overtime) */
  jobExtra?: React.ReactNode;
  /** Out-of-town job: which day of the trip today is */
  trip?: Trip | null;
};

export default function HomeBody(p: Props) {
  const t = useT();
  const router = useRouter();
  const { c, space } = useTokens();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadSummary = useCallback(() => { getHomeSummary().then(setSummary).catch(() => {}); }, []);
  useFocusRefresh(loadSummary);
  const refresh = async () => { setRefreshing(true); await Promise.all([p.onRefresh(), getHomeSummary().then(setSummary).catch(() => {})]); setRefreshing(false); };

  const openItem = (item: AttentionItem) => {
    if (item.kind === 'leave') go('/leave');
    else if (item.kind === 'policy') router.push('/handbook' as Href);
    else if (item.date) router.push(`/dtr-day?date=${item.date}` as Href);
  };
  function go(path: string) { router.push(path as Href); }
  const isToday = !!p.job && manilaDay(p.job.start_time) === manilaDay(new Date());

  const online = useOnline();
  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: 8, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.brand} colors={[c.brand]} />}
    >
      <Animated.View entering={arrive(0, reduced)}>
        <HomeHeader />
        <OfflineBanner online={online} />
        <View ref={tourTarget('timeIn')} collapsable={false}>{/* Techy's tour points here */}
          {/* Task 3: today's job is part of the time-in card (what you are timing in for) */}
          <TimeInCard shift={p.shift} busy={p.busy} onTimeIn={p.onTimeIn} onTimeOut={p.onTimeOut} onOfficeCheckIn={p.onOfficeCheckIn}
            job={p.job && isToday ? <TodayJob inside job={p.job} trip={p.trip} onDetails={() => p.job && go(`/job/${p.job.id}`)} /> : undefined} />
        </View>
        {isToday && p.jobExtra && <View style={{ marginTop: 10 }}>{p.jobExtra}</View>}

        {/* A later job only (none today): its own card. No job at all: nothing, the card above says so */}
        {p.job && !isToday && <>
          <SectionLabel>{t('home.nextJob', { date: dateOf(p.job.start_time) })}</SectionLabel>
          <TodayJob job={p.job} onDetails={() => p.job && go(`/job/${p.job.id}`)} />
        </>}

        <SectionLabel>{t('home.shortcuts')}</SectionLabel>
        <QuickActions toolsWithYou={summary?.toolsWithYou ?? 0} onTools={() => go('/tools')} onLeave={() => go('/leave')} onDtr={() => go('/dtr')} />
        {/* Accidents, vehicle problems and anything else for the office (prof, 20 Nov) */}
        <Card padded={false} style={{ marginTop: 10 }}>
          <ListRow icon="alert-circle" title={t('issue.title')} subtitle={t('issue.subtitle')} onPress={() => go('/report-issue')} last />
        </Card>

        <SectionLabel>{t('home.attention')}</SectionLabel>
        {summary && <AttentionList items={summary.attention} onOpen={openItem} />}
      </Animated.View>
    </ScrollView>
  );
}
