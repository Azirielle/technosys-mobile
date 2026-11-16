// Jobs tab, in the order a technician thinks: the job now or next (big, with Navigate), what the office
// changed this week (moved, cancelled, VIP squeeze-ins), later today, coming up by day, and earlier (folded).
// It updates live: when the office edits a job you're on, the list reloads and Techy tells you.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useFocusRefresh } from '../../lib/useFocusRefresh';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '../../lib/i18n';
import { getMyJobs, manilaDay, watchMyJobs, Job, MyJobs } from '../../lib/jobs';
import { supabase } from '../../lib/supabase';
import JobCard from '../../components/jobs/JobCard';
import JobHero from '../../components/jobs/JobHero';
import JobChanges from '../../components/jobs/JobChanges';
import PastJobs from '../../components/jobs/PastJobs';
import { dateOf } from '../../components/jobs/jobWords';
import { Notice, SectionLabel, SkeletonCard, TAB_BAR_HEIGHT, Techy, Txt, arrive, techy, useReducedMotion, useShowSkeleton, useTokens } from '../../ui';

/** Coming-up jobs grouped by Manila day, in order. */
const byDay = (jobs: Job[]) => jobs.reduce<{ day: string; jobs: Job[] }[]>((groups, j) => {
  const day = manilaDay(j.start_time);
  const last = groups[groups.length - 1];
  if (last?.day === day) last.jobs.push(j); else groups.push({ day, jobs: [j] });
  return groups;
}, []);

export default function JobsTab() {
  const t = useT();
  const { c, space } = useTokens();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [jobs, setJobs] = useState<MyJobs | null>(null);
  const [myId, setMyId] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showEarlier, setShowEarlier] = useState(false);
  const showSkeleton = useShowSkeleton(!jobs && !failed);
  const tRef = useRef(t);
  tRef.current = t;

  // Reloads keep the old list on screen until the new one arrives (no flashing, no replayed animation).
  const load = useCallback(async () => {
    try {
      const [{ data: { user } }, mine] = await Promise.all([supabase.auth.getUser(), getMyJobs()]);
      setMyId(user?.id);
      setJobs(mine);
      setFailed(false);
    } catch { setFailed(true); }
  }, []);
  useFocusRefresh(load);
  useEffect(() => watchMyJobs(() => {
    load();
    techy.say(tRef.current('jobs.changedSay'), { tone: 'info', mood: 'wave' });
  }), [load]);

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const empty = jobs && !jobs.now && !jobs.laterToday.length && !jobs.upcoming.length && !jobs.past.length && !jobs.changes.length;
  const list = (items: Job[]) => (
    <View style={{ gap: 10 }}>
      {items.map((j) => <JobCard key={j.id} job={j} change={jobs?.changeFor[j.id]} />)}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.brand} colors={[c.brand]} />}
      >
        <Txt variant="title" accessibilityRole="header" style={{ marginBottom: 12 }}>{t('jobs.title')}</Txt>
        {failed && <View style={{ marginBottom: 12 }}><Notice tone="error" text={t('jobs.loadFailed')} /></View>}
        {showSkeleton && <View style={{ gap: 10 }}><SkeletonCard height={220} /><SkeletonCard /><SkeletonCard /></View>}
        {empty && (
          <View style={{ alignItems: 'center', paddingVertical: 48, gap: 8 }}>
            <Techy mood="wave" size={120} />
            <Txt variant="heading" center>{t('jobs.empty')}</Txt>
            <Txt variant="body" color="ink2" center>{t('jobs.emptySub')}</Txt>
          </View>
        )}
        {jobs && !empty && (
          <Animated.View entering={arrive(0, reduced)}>
            {jobs.now
              ? <JobHero job={jobs.now} isToday={jobs.nowIsToday} change={jobs.changeFor[jobs.now.id]} myId={myId} />
              : <Notice tone="info" text={t('jobs.nothingNext')} />}
            {!jobs.nowIsToday && jobs.now && <Txt variant="caption" color="ink2" style={{ marginTop: 8 }}>{t('jobs.noneToday')}</Txt>}

            {jobs.changes.length > 0 && (<><SectionLabel>{t('jobs.whatChanged')}</SectionLabel><JobChanges changes={jobs.changes} /></>)}

            {jobs.laterToday.length > 0 && (<><SectionLabel>{t('jobs.laterToday')}</SectionLabel>{list(jobs.laterToday)}</>)}

            {jobs.upcoming.length > 0 && <SectionLabel>{t('jobs.upcoming')}</SectionLabel>}
            {byDay(jobs.upcoming).map((g) => (
              <View key={g.day} style={{ marginBottom: 12 }}>
                <Txt variant="label" color="ink2" style={{ marginBottom: 6 }}>{dateOf(g.jobs[0]!.start_time)}</Txt>
                {list(g.jobs)}
              </View>
            ))}

            {jobs.past.length > 0 && (
              <>
                <Pressable onPress={() => setShowEarlier((s) => !s)} accessibilityRole="button" hitSlop={6}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18, marginBottom: 10 }}>
                  <Txt variant="label" color="ink2">{t(showEarlier ? 'jobs.hideEarlier' : 'jobs.showEarlier', { n: jobs.past.length })}</Txt>
                  <Feather name={showEarlier ? 'chevron-up' : 'chevron-down'} size={16} color={c.ink2} />
                </Pressable>
                {showEarlier && <PastJobs jobs={jobs.past} />}
              </>
            )}
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
