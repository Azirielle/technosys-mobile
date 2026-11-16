// TechyDock (motion #14): Techy as an overlay on every tab, docked at the screen edge above the tab bar.
// Normally tucked (mostly hidden, tilted, peeking in). It slides out only to react (techy.react) or to
// say something useful (techy.say), then tucks back. Tap it to Ask Techy; drag it to the other edge.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Techy, { TechyMood } from './Techy';
import Txt from './Txt';
import { TAB_BAR_HEIGHT } from './TabBar';
import { useReducedMotion } from './motion';
import { useTokens } from './useTokens';
import type { Tone } from './Status';

const SIZE = 84;
const TUCK = 48; // how far it hides past the edge
type Event = { kind: 'react'; mood: TechyMood; ms?: number } | { kind: 'say'; text: string; tone?: Tone; mood?: TechyMood; ms?: number };
const listeners = new Set<(e: Event) => void>();

/** Make Techy react or speak from anywhere (e.g. after a time-in). */
export const techy = {
  react: (mood: TechyMood, ms?: number) => listeners.forEach((l) => l({ kind: 'react', mood, ms })),
  say: (text: string, opts: { tone?: Tone; mood?: TechyMood; ms?: number } = {}) => listeners.forEach((l) => l({ kind: 'say', text, ...opts })),
};

export default function TechyDock({ onAsk }: { onAsk: () => void }) {
  const { c, shadow } = useTokens();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [side, setSide] = useState<'left' | 'right'>('right');
  const [mood, setMood] = useState<TechyMood>('ready');
  const [bubble, setBubble] = useState<{ text: string; tone?: Tone } | null>(null);
  const out = useSharedValue(0);      // 0 tucked, 1 out
  const drag = useSharedValue(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => { AsyncStorage.getItem('techy_side').then((s) => { if (s === 'left' || s === 'right') setSide(s); }).catch(() => {}); }, []);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const slideOut = useCallback((ms: number) => {
    clearTimers();
    out.value = reduced ? withTiming(1, { duration: 0 }) : withSpring(1, { damping: 14, stiffness: 180 });
    timers.current.push(setTimeout(() => {
      setBubble(null);
      setMood((m) => (m === 'rest' ? 'rest' : 'ready'));
      out.value = reduced ? withTiming(0, { duration: 0 }) : withSpring(0, { damping: 16, stiffness: 160 });
    }, ms));
  }, [out, reduced]);

  useEffect(() => {
    const listener = (e: Event) => {
      if (e.kind === 'react') { setBubble(null); setMood(e.mood); slideOut(e.ms ?? 2600); }
      else { setMood(e.mood ?? 'wave'); setBubble({ text: e.text, tone: e.tone }); slideOut(e.ms ?? 4400); }
    };
    listeners.add(listener);
    const hello = setTimeout(() => listener({ kind: 'react', mood: 'wave', ms: 1800 }), 1500); // show it's there
    return () => { listeners.delete(listener); clearTimeout(hello); clearTimers(); };
  }, [slideOut]);

  // Drag sideways to move Techy to the other edge
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6,
    onPanResponderGrant: () => { setBubble(null); out.value = withTiming(1, { duration: 120 }); },
    onPanResponderMove: (_, g) => { drag.value = g.dx; },
    onPanResponderRelease: (_, g) => {
      setSide((s) => {
        const next = (s === 'right' && g.dx < -60) ? 'left' : (s === 'left' && g.dx > 60) ? 'right' : s;
        AsyncStorage.setItem('techy_side', next).catch(() => {});
        return next;
      });
      drag.value = 0;
      slideOut(1400);
    },
  })).current;

  const dir = side === 'right' ? 1 : -1;
  const dock = useAnimatedStyle(() => ({
    transform: [
      { translateX: dir * TUCK * (1 - out.value) + drag.value },
      { rotate: `${dir * -12 * (1 - out.value)}deg` },
    ],
  }));

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom, 10) + TAB_BAR_HEIGHT + 14 }}>
      <Animated.View {...pan.panHandlers} style={[{ position: 'absolute', bottom: 0, width: SIZE, height: SIZE * 0.92, [side]: 2 }, shadow.raised, dock]}>
        <Pressable onPress={onAsk} accessibilityRole="button" accessibilityLabel="Techy, your helper. Tap to ask a question." accessibilityHint="Drag sideways to move it to the other edge">
          <View style={{ transform: [{ scaleX: side === 'left' ? -1 : 1 }] }}>
            <Techy mood={mood} size={SIZE} />
          </View>
        </Pressable>
        {bubble && (
          <Animated.View
            entering={reduced ? undefined : FadeIn.duration(180).delay(150)}
            exiting={FadeOut.duration(150)}
            pointerEvents="none"
            style={[{
              position: 'absolute', top: 4, [side === 'right' ? 'right' : 'left']: SIZE - 2, maxWidth: 200,
              backgroundColor: c.card, paddingHorizontal: 11, paddingVertical: 8,
              borderRadius: 14, [side === 'right' ? 'borderBottomRightRadius' : 'borderBottomLeftRadius']: 4,
            }, shadow.raised]}
          >
            <Txt variant="label" style={{ color: bubble.tone ? c[bubble.tone] : c.ink }}>{bubble.text}</Txt>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}
