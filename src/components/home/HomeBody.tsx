// Home, top to bottom by importance: date and bell → time-in card → today's job → three shortcuts → needs your
// attention. Everything arrives together. Time in/out comes from lib/useTimeIn (via the Home screen); this file
// arranges what you see. The Inbox, Details, My tools, Leave and Updates open as full screens (slide in).
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter, type Href } from 'expo-router';
import { useFocusRefresh } from '../../lib/useFocusRefresh';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '../../lib/i18n';
import { getHomeSummary, AttentionItem, HomeSummary } from '../../lib/homeSummary';
import { countUnread, watchInbox } from '../../lib/inbox';
import { manilaDay, type Job } from '../../lib/jobs';
import { SectionLabel, TAB_BAR_HEIGHT, arrive, useReducedMotion, useTokens } from '../../ui';
import { dateOf } from '../jobs/jobWords';
import HomeHeader from './HomeHeader';
import TimeInCard, { ShiftState } from './TimeInCard';
import TodayJob from './TodayJob';
import QuickActions from './QuickActions';
import AttentionList from './AttentionList';

type Props = {
  shift: ShiftState;
  /** Shown on the job card only when today's time-in is on that job */
  jobShift?: ShiftState;
  busy: boolean;
  job: Job | null;
  onTimeIn: () => void;
  onTimeOut: () => void;
  onRefresh: () => Promise<void>;
  /** Shown under today's job (Work v2: Arrived / Done / Ask for overtime) */
  jobExtra?: React.ReactNode;
};

export default function HomeBody(p: Props) {
  const t = useT();
  const router = useRouter();
  const { c, space } = useTokens();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);

  const loadUnread = useCallback(() => { countUnread().then(setUnread).catch(() => {}); }, []);
  const loadSummary = useCallback(() => { getHomeSummary().then(setSummary).catch(() => {}); loadUnread(); }, [loadUnread]);
  useFocusRefresh(loadSummary);
  useEffect(() => watchInbox(loadUnread), [loadUnread]);
  const refresh = async () => { setRefreshing(true); await Promise.all([p.onRefresh(), getHomeSummary().then(setSummary).catch(() => {}), countUnread().then(setUnread).catch(() => {})]); setRefreshing(false); };

  const openItem = (item: AttentionItem) => {
    if (item.kind === 'leave') go('/leave');
    else if (item.kind === 'policy') router.push('/handbook' as Href);
    else if (item.date) router.push(`/dtr-day?date=${item.date}` as Href);
  };
  function go(path: string) { router.push(path as Href); }
  const isToday = !!p.job && manilaDay(p.job.start_time) === manilaDay(new Date());

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: 8, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.brand} colors={[c.brand]} />}
    >
      <Animated.View entering={arrive(0, reduced)}>
        <HomeHeader unread={unread} onBell={() => go('/inbox')} />
        <TimeInCard shift={p.shift} busy={p.busy} onTimeIn={p.onTimeIn} onTimeOut={p.onTimeOut} />

        <SectionLabel>{!p.job || isToday ? t('home.todaysJob') : t('home.nextJob', { date: dateOf(p.job.start_time) })}</SectionLabel>
        <TodayJob job={p.job} shift={p.jobShift} onDetails={() => p.job && go(`/job/${p.job.id}`)} onAllJobs={() => router.navigate('/(tabs)/jobs' as Href)} />
        {p.jobExtra}

        <SectionLabel>{t('home.shortcuts')}</SectionLabel>
        <QuickActions toolsWithYou={summary?.toolsWithYou ?? 0} onTools={() => go('/tools')} onLeave={() => go('/leave')} onUpdates={() => go('/updates')} />

        <SectionLabel>{t('home.attention')}</SectionLabel>
        {summary && <AttentionList items={summary.attention} onOpen={openItem} />}
      </Animated.View>
    </ScrollView>
  );
}
