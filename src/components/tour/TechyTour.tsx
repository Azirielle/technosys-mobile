// TechyTour: Techy's first-time tour on the real screens (Andrew's research, 19 Nov). The main tour (on Home, after
// setup): welcome → spotlight on the Time in card → the Inbox tab → Techy itself → "your turn: tap Jobs" (learn by
// doing) → a cheer and "Let's go!". Short tips the first time someone opens Inbox or Profile. Each plays once per
// person per phone for field staff (lib/setup.ts isTourDue); Profile replays the main one (startTechyTour).
// The time-out tip plays the first time someone is timed in on Home (showTechyTip from WorkHome).
// Drawn over the tabs (app/(tabs)/_layout.tsx); the real parts register with tourTarget() (ui/tourTargets.ts).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOutDown } from 'react-native-reanimated';
import { useT } from '../../lib/i18n';
import { isTourDue, markTourDone, type TourName } from '../../lib/setup';
import { Button, TAB_BAR_HEIGHT, Techy, Txt, findTarget, haptic, techy, techyDock, useReducedMotion, useTokens, type TargetBox, type TechyMood } from '../../ui';

/** One stop: what Techy says, what it points at, and how you move on. */
type Stop = { text: string; mood: TechyMood; target?: string; kind?: 'hello' | 'dock' | 'action' | 'yay' };
const TOURS: Record<TourName, Stop[]> = {
  main: [
    { text: 'tour.hello2', mood: 'wave', kind: 'hello' },
    { text: 'tour.timeIn', mood: 'ready', target: 'timeIn' },
    { text: 'tour.inbox', mood: 'wave', target: 'tab-inbox' },
    { text: 'tour.techy', mood: 'cheer', kind: 'dock' },
    { text: 'tour.action', mood: 'ready', target: 'tab-jobs', kind: 'action' },
    { text: 'tour.celebrate', mood: 'cheer', kind: 'yay' },
  ],
  inbox: [{ text: 'tour.inboxTip', mood: 'wave', target: 'inbox-first' }],
  profile: [
    { text: 'tour.languageTip', mood: 'ready', target: 'profile-language' },
    { text: 'tour.replayTip', mood: 'wave', target: 'profile-replay' },
  ],
  timeOut: [{ text: 'tour.timeOutTip', mood: 'ready', target: 'timeIn' }], // the time-in card, now showing Time out
};
const TIP_TAB: Partial<Record<string, TourName>> = { inbox: 'inbox', profile: 'profile' };
const DOCK = 84, PAD = 8;

const listeners = new Set<() => void>();
/** Plays the main tour again (Profile → "Replay Techy's tour"). */
export function startTechyTour() { listeners.forEach((l) => l()); }
const tipAsks = new Set<(name: TourName) => void>();
/** A tip for something on screen now (e.g. the Time out button), once per person per phone. */
export function showTechyTip(name: TourName) { tipAsks.forEach((l) => l(name)); }

export default function TechyTour({ tab }: { tab: string }) {
  const t = useT();
  const { c, radius, shadow } = useTokens();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const root = useRef<View>(null);
  const tipsStarted = useRef(new Set<TourName>()); // tips already shown while the app is open
  const [size, setSize] = useState({ w: 0, h: 0 }); // this layer's size: everything is placed inside it
  const [tour, setTour] = useState<{ name: TourName; i: number } | null>(null);
  const [box, setBox] = useState<TargetBox | null>(null);
  const stops = tour ? TOURS[tour.name] : [];
  const stop = tour ? stops[tour.i] : null;

  const start = useCallback((name: TourName) => {
    if (name === 'main') router.navigate('/(tabs)' as Href); // the main tour starts on Home
    techy.away(true); // this Techy guides; the dock is empty meanwhile
    setTour({ name, i: 0 });
  }, []);
  const finish = useCallback(() => {
    if (tour) markTourDone(tour.name);
    setTour(null); setBox(null);
    techy.away(false);
  }, [tour]);
  const next = useCallback(() => {
    haptic.tap();
    if (tour && tour.i + 1 < TOURS[tour.name].length) setTour({ ...tour, i: tour.i + 1 });
    else finish();
  }, [tour, finish]);

  useEffect(() => {
    isTourDue('main').then((due) => { if (due) start('main'); }).catch(() => {});
    const replay = () => start('main');
    listeners.add(replay);
    return () => { listeners.delete(replay); };
  }, [start]);

  // First visit to Inbox or Profile, or a tip a screen asks for: a short tip (only when no tour is running)
  const [asked, setAsked] = useState<TourName | null>(null);
  useEffect(() => { tipAsks.add(setAsked); return () => { tipAsks.delete(setAsked); }; }, []);
  useEffect(() => {
    const name = TIP_TAB[tab] ?? (tab === 'index' ? asked : null);
    if (!name || tour || tipsStarted.current.has(name)) return;
    let alive = true;
    isTourDue(name).then((due) => {
      if (!due || !alive) return;
      tipsStarted.current.add(name); // the "seen" save is async; don't re-check in that gap
      start(name);
    }).catch(() => {});
    return () => { alive = false; };
  }, [tab, tour, start, asked]);

  // Find the real part to spotlight, measured the same way as this layer so they line up on every phone.
  // A part that isn't showing (or is scrolled off the screen) is skipped.
  useEffect(() => {
    setBox(null);
    if (!stop || !size.h) return;
    if (stop.kind === 'dock') { // Techy stands in its own dock spot
      const x = techyDock.side === 'left' ? 2 : size.w - 2 - DOCK;
      setBox({ x, y: size.h - (Math.max(insets.bottom, 10) + TAB_BAR_HEIGHT + 14) - DOCK * 0.92, width: DOCK, height: DOCK * 0.92 });
      return;
    }
    if (!stop.target) return;
    let alive = true, tries = 0, timer: ReturnType<typeof setTimeout>;
    const look = async () => {
      const [b, me] = await Promise.all([findTarget(stop.target!), new Promise<TargetBox>((done) => root.current?.measureInWindow((x, y, width, height) => done({ x, y, width, height })))]);
      if (!alive) return;
      const inside = b && { x: b.x - me.x, y: b.y - me.y, width: b.width, height: b.height };
      if (inside && inside.y >= 0 && inside.y + inside.height <= size.h) setBox(inside);
      else if (++tries < 6) timer = setTimeout(look, 350); // still loading (e.g. the Inbox list): look again, up to ~2 s
      else next();
    };
    timer = setTimeout(look, 350);
    return () => { alive = false; clearTimeout(timer); };
  }, [stop, size, insets.bottom, next]);

  // Learn by doing: the real Jobs tab was tapped
  useEffect(() => { if (stop?.kind === 'action' && tab === 'jobs') { haptic.success(); next(); } }, [stop, tab, next]);

  // The phone's Back button skips
  useEffect(() => {
    if (!tour) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { finish(); return true; });
    return () => sub.remove();
  }, [tour, finish]);

  const dim = c.scrimStrong;
  const fill = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
  return (
    <View ref={root} pointerEvents="box-none" style={fill} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {stop && (() => {
        const middle = stop.kind === 'hello' || stop.kind === 'yay';
        if (!middle && !box) return <View style={[fill, { backgroundColor: dim }]} />;
        const hole = box && { x: box.x - PAD, y: box.y - PAD, w: box.width + PAD * 2, h: box.height + PAD * 2 };
        const spots = stops.filter((s) => s.kind !== 'hello' && s.kind !== 'yay');
        const n = spots.indexOf(stop) + 1;
        // The bubble and Techy go on the side away from the spotlight, so they never cover it
        const below = !!hole && hole.y + hole.h / 2 < size.h / 2;
        const place = middle || !hole ? { top: size.h * 0.22 } : below ? { top: hole.y + hole.h + 12 } : { bottom: size.h - hole.y + 12 };
        const lastTip = tour!.name !== 'main' && tour!.i === stops.length - 1;
        return (
          <>
            {hole ? (
              <>
                {/* dim everything except the spotlight; taps on the dim part go nowhere */}
                <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: Math.max(0, hole.y), backgroundColor: dim }} />
                <View style={{ position: 'absolute', left: 0, right: 0, top: hole.y + hole.h, bottom: 0, backgroundColor: dim }} />
                <View style={{ position: 'absolute', left: 0, width: Math.max(0, hole.x), top: hole.y, height: hole.h, backgroundColor: dim }} />
                <View style={{ position: 'absolute', left: hole.x + hole.w, right: 0, top: hole.y, height: hole.h, backgroundColor: dim }} />
                <View pointerEvents="none" style={{ position: 'absolute', left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: radius.card, borderWidth: 3, borderColor: c.accent }} />
                {/* only "your turn" lets the tap through to the real button */}
                {stop.kind !== 'action' && <View style={{ position: 'absolute', left: hole.x, top: hole.y, width: hole.w, height: hole.h }} />}
              </>
            ) : <View style={[fill, { backgroundColor: dim }]} />}

            <Animated.View key={`${tour!.name}-${tour!.i}`} entering={reduced ? undefined : FadeIn.duration(220)} exiting={reduced ? undefined : FadeOutDown.duration(250)}
              style={{ position: 'absolute', left: 16, right: 16, ...place, alignItems: middle ? 'center' : hole && hole.x + hole.w / 2 < size.w / 2 ? 'flex-end' : 'flex-start', gap: 8 }}>
              <View style={[{ alignSelf: 'stretch', backgroundColor: c.card, borderRadius: radius.card, padding: 16, gap: 10 }, shadow.raised]} accessibilityLiveRegion="polite">
                {stop.kind === 'hello' && <Txt variant="title">{t('tour.hello1')}</Txt>}
                <Txt variant="body" style={{ fontSize: 16, lineHeight: 23 }}>{t(stop.text)}</Txt>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  {stop.kind !== 'yay' && !lastTip && (
                    <Pressable onPress={finish} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('tour.skip')}>
                      <Txt variant="label" color="ink2">{t('tour.skip')}</Txt>
                    </Pressable>
                  )}
                  {n > 0 && spots.length > 1 && <Txt variant="caption" color="ink3">{t('tour.of', { n, total: spots.length })}</Txt>}
                  {stop.kind === 'hello' && <Button label={t('tour.showMe')} size="md" icon="arrow-right" onPress={next} />}
                  {(!stop.kind || stop.kind === 'dock') && <Button label={t(lastTip || (tour!.name !== 'main' && spots.length === 1) ? 'tour.gotIt' : 'tour.next')} size="md" icon="arrow-right" onPress={next} />}
                  {stop.kind === 'yay' && <View style={{ flex: 1 }}><Button label={t('tour.done')} icon="check" onPress={() => { haptic.tap(); finish(); }} /></View>}
                </View>
              </View>
              {stop.kind !== 'dock' && <Techy mood={stop.mood} size={middle ? 130 : 84} />}
            </Animated.View>

            {/* Techy steps into its own dock spot to say "tap me" */}
            {stop.kind === 'dock' && box && <View pointerEvents="none" style={{ position: 'absolute', left: box.x, top: box.y }}><Techy mood="cheer" size={DOCK} /></View>}
          </>
        );
      })()}
    </View>
  );
}
