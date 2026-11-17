// DTR screen (opened from Home), for a first-time user: one summary card (hours counted, workdays you showed up), then the days that
// need a look (late, absent, no time-out, HR checking), then every day. Tapping a day opens its own screen with
// how it was counted and an "Ask HR about this day" button. Same rules as the admin DTR (lib/dtr.ts).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter, type Href } from 'expo-router';
import { useFocusRefresh } from '../lib/useFocusRefresh';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '../lib/i18n';
import { Cutoff, DtrResult, cutoffFor, getMyDtr, manilaDate, shiftCutoff } from '../lib/dtr';
import DtrHero from '../components/dtr/DtrHero';
import DtrDayRow from '../components/dtr/DtrDayRow';
import { needsALook } from '../components/dtr/dayTags';
import {
  BackHeader, Card, Notice, SectionLabel, SkeletonCard, SkeletonRow, StatusText, Txt, arrive, useReducedMotion, useShowSkeleton, useTokens,
} from '../ui';

const label = (c: Cutoff) => {
  const s = new Date(`${c.start}T00:00:00Z`), e = new Date(`${c.end}T00:00:00Z`);
  return `${s.toLocaleDateString([], { month: 'short', timeZone: 'UTC' })} ${s.getUTCDate()} – ${e.getUTCDate()}`;
};

export default function DtrScreen() {
  const t = useT();
  const router = useRouter();
  const { c, space } = useTokens();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [cut, setCut] = useState<Cutoff>(() => cutoffFor(manilaDate(new Date())));
  const [dtr, setDtr] = useState<DtrResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const showSkeleton = useShowSkeleton(!dtr && !failed);
  const isCurrent = cut.end >= manilaDate(new Date());
  const cutRef = useRef(cut);
  cutRef.current = cut;

  // Coming back to the screen refreshes quietly (no blank screen, no replayed animation).
  const load = useCallback(async (which: Cutoff) => {
    try {
      const r = await getMyDtr(which);
      if (cutRef.current === which) { setDtr(r); setFailed(false); }
    } catch { if (cutRef.current === which) setFailed(true); }
  }, []);
  useEffect(() => { setDtr(null); load(cut); }, [cut, load]);
  useFocusRefresh(() => load(cutRef.current), { onMount: false }); // the cut-off effect above does the first load

  const refresh = async () => { setRefreshing(true); await load(cut); setRefreshing(false); };
  const openDay = (date: string) => router.push(`/dtr-day?date=${date}` as Href);
  const flagged = dtr?.days.filter(needsALook) ?? [];

  const arrow = (step: -1 | 1, disabled: boolean, a11y: string) => (
    <Pressable onPress={() => setCut((cur) => shiftCutoff(cur, step))} disabled={disabled} hitSlop={8} accessibilityRole="button" accessibilityLabel={a11y}
      style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1 }}>
      <Feather name={step === -1 ? 'chevron-left' : 'chevron-right'} size={22} color={c.ink2} />
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={['top']}>
      <BackHeader label={t('common.back')} />
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingTop: 0, paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.brand} colors={[c.brand]} />}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Txt variant="title" accessibilityRole="header" style={{ flex: 1 }}>{t('dtr.title')}</Txt>
          {arrow(-1, false, t('dtr.earlier'))}
          <Txt variant="label" style={{ minWidth: 96, textAlign: 'center' }}>{label(cut)}</Txt>
          {arrow(1, isCurrent, t('dtr.later'))}
        </View>

        {failed && <Notice tone="error" text={t('dtr.loadFailed')} />}
        {showSkeleton && <View style={{ gap: 10 }}><SkeletonCard height={150} /><Card padded={false}><SkeletonRow /><SkeletonRow /><SkeletonRow /></Card></View>}
        {dtr && (
          <Animated.View entering={arrive(0, reduced)}>
            <DtrHero dtr={dtr} />

            <SectionLabel>{t('dtr.needsLook')}</SectionLabel>
            {flagged.length === 0
              ? <Card><StatusText tone="ok" label={t('dtr.allClear')} /></Card>
              : <Card padded={false}>{flagged.map((d, i) => <DtrDayRow key={d.date} day={d} onPress={() => openDay(d.date)} last={i === flagged.length - 1} />)}</Card>}

            <SectionLabel>{t('dtr.everyDay')}</SectionLabel>
            <Txt variant="caption" color="ink2" style={{ marginTop: -4, marginBottom: 8 }}>{t('dtr.tapHint')}</Txt>
            {dtr.days.length === 0
              ? <Txt variant="body" color="ink2">{t('dtr.empty')}</Txt>
              : <Card padded={false}>{dtr.days.map((d, i) => <DtrDayRow key={d.date} day={d} onlyFirstTag onPress={() => openDay(d.date)} last={i === dtr.days.length - 1} />)}</Card>}
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
