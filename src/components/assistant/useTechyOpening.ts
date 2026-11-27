// useTechyOpening (motion #15, agreed with Andrew in docs/ui-library/prototype/techy-chat.html). Opening Techy's chat:
// Techy squishes, grows its second arm and scoots to the opposite edge, pinches the screen and pulls it toward you
// (holding on as the page lifts), lets go so the page turns over by itself, and hops up into its seat in the chat
// header. Closing: the chat slides down while Techy goes straight back to its dock. Techy holds still while moving.
// With "Reduce motion" the chat just appears and disappears.
// Why it's built this way (Andrew's phone tests, 18 Nov):
// - The whole opening is ONE clock on the animation thread. Steps that waited for JavaScript in between left the page
//   stuck half-folded and made the hop stutter while the chat underneath was loading.
// - The page turn is 2D (the page narrows toward its hinge, as a turning page looks from the front): Android drew the
//   prototype's 3D perspective far weaker, so the page barely turned and Techy's grip drifted off it.
import { useCallback, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { TAB_BAR_HEIGHT, techyDock, useReducedMotion, type TechyMood } from '../../ui';

export const BIG = 84;                    // Techy's size in the dock
export const TECHY_H = (BIG * 110) / 120; // its drawing is 120 × 110
export const SEAT = 48;                   // its size in the chat header
export const SEAT_LEFT = 14, SEAT_TOP = 10;
const LIFT = 34, GONE = 90;               // how far Techy pulls the page (deg); the page is edge-on and gone (deg)
const PINCH_IN = 46;                      // how far in from the edge Techy stands to pinch it

// The opening, in ms on one clock: [start, length]
const SQUISH = [0, 240], WALK = [240, 620], ARMS = [240, 220], PINCH = [860, 140], PULL = [1000, 420];
const TURN = [1420, 560], LET_GO = [1420, 160], HOP = [1480, 480], LAND = [1960, 300];
const TOTAL = 2260;

/** 0→1 progress of a step at time t (ms). */
const step = (t: number, [start, len]: number[]) => { 'worklet'; return Math.min(1, Math.max(0, (t - start) / len)); };
const sine = (x: number) => { 'worklet'; return -(Math.cos(Math.PI * x) - 1) / 2; };
const inOut = (x: number) => { 'worklet'; return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const out = (x: number) => { 'worklet'; return 1 - Math.pow(1 - x, 3); };
const back = (x: number) => { 'worklet'; const c = 1.2; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

/** Runs a shared value to `to` and resolves when it's there (closing only). */
function run(sv: SharedValue<number>, to: number, duration: number) {
  return new Promise<void>((done) => {
    sv.value = withTiming(to, { duration, easing: Easing.inOut(Easing.cubic) }, () => scheduleOnRN(done));
    setTimeout(done, duration + 400); // if the phone never reports the end, closing still finishes (no stuck chat)
  });
}

export function useTechyOpening() {
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const [mood, setMood] = useState<TechyMood>('cheer');
  const [still, setStill] = useState(true);
  const side = useSharedValue(1);    // 1: docked right, pinches the left edge; -1: docked left (all mirrored)
  const clock = useSharedValue(0);   // the opening, 0 → TOTAL ms
  const closing = useSharedValue(0); // 1 while closing
  const home = useSharedValue(0), tuckBack = useSharedValue(0), slide = useSharedValue(0);

  const dockY = H - (Math.max(insets.bottom, 10) + TAB_BAR_HEIGHT + 14) - TECHY_H / 2; // TechyDock's spot
  const g = { W, H, dockX: W - 2 - BIG / 2, dockY, pinchY: dockY - 40, seatX: SEAT_LEFT + SEAT / 2, seatY: insets.top + SEAT_TOP + SEAT / 2 };

  /** The page's turn (deg) at time t. */
  const pageDeg = (t: number) => {
    'worklet';
    return t < PULL[0] ? 0 : t < TURN[0] ? inOut(step(t, PULL)) * LIFT : LIFT + out(step(t, TURN)) * (GONE - LIFT);
  };
  /** Where the pinched edge is (the page is cos(deg) of its width), and how big Techy looks while it pulls. */
  const edgeAt = (deg: number, s: number) => {
    'worklet';
    const rad = (deg * Math.PI) / 180, x = g.W * (1 - Math.cos(rad));
    return { x: s === 1 ? x : g.W - x, y: g.pinchY + Math.sin(rad) * 18, k: 1 + Math.sin(rad) * 0.15 };
  };

  const techyStyle = useAnimatedStyle(() => {
    const s = side.value, mx = (x: number) => (s === 1 ? x : g.W - x), pi = Math.PI;
    let x: number, y: number, sc: number, rot: number, sx = 1, sy = 1;
    if (closing.value) {                                                       // straight home, then tuck in
      const h = home.value, tk = tuckBack.value;
      x = g.seatX + (mx(g.dockX) - g.seatX) * h + s * tk * 48;
      y = g.seatY + (g.dockY - g.seatY) * h - Math.sin(h * pi) * 40;
      sc = SEAT / BIG + (1 - SEAT / BIG) * h; rot = s * (10 * Math.sin(h * pi) - 12 * tk);
    } else {
      const t = clock.value;
      const squish = Math.sin(step(t, SQUISH) * pi), tuck = 1 - out(step(t, SQUISH));
      const pinch = out(step(t, PINCH)), pull = inOut(step(t, PULL)), hop = inOut(step(t, HOP));
      sx = 1 + 0.08 * squish + 0.1 * pinch * (1 - pull); sy = 1 - 0.1 * squish - 0.12 * pinch * (1 - pull);
      if (t < PULL[0]) {                                                       // squish, untuck, scoot across
        const w = sine(step(t, WALK));
        x = mx(g.dockX + (PINCH_IN - g.dockX) * w) + s * tuck * 48;
        y = g.dockY + (g.pinchY - g.dockY) * w - Math.sin(w * pi) * 26;
        sc = 1; rot = s * (-12 * tuck - 8 * Math.sin(w * pi));
      } else {                                                                 // holds the edge, then hops to its seat
        const e = edgeAt(Math.min(pageDeg(t), LIFT), s), ex = e.x + s * PINCH_IN * e.k;
        x = ex + (g.seatX - ex) * hop; y = e.y + (g.seatY - e.y) * hop - Math.sin(hop * pi) * 30;
        sc = e.k + (SEAT / BIG - e.k) * hop; rot = s * 12 * (t < TURN[0] ? pull : 1 - hop);
        const land = Math.sin(step(t, LAND) * pi);                             // one soft landing
        sx = sx + 0.1 * land; sy = sy - 0.14 * land;
      }
    }
    return { transform: [{ translateX: x - BIG / 2 }, { translateY: y - TECHY_H / 2 }, { rotate: `${rot}deg` }, { scaleX: s * sc * sx }, { scaleY: sc * sy }] };
  });
  // The arms: grow while it sets off, let go after the pull
  const hands = useDerivedValue(() => (closing.value ? 0 : back(step(clock.value, ARMS)) * (1 - step(clock.value, LET_GO))));
  const screenStyle = useAnimatedStyle(() => {
    // Narrows toward the hinge (the edge away from the pinch); the hinge stays put
    const w = closing.value ? 1 : Math.max(0.001, Math.cos((pageDeg(clock.value) * Math.PI) / 180));
    return { transform: [{ translateX: side.value * (g.W / 2) * (1 - w) }, { scaleX: w }] };
  });
  const shadeStyle = useAnimatedStyle(() => ({ opacity: closing.value ? 0 : Math.min(1, pageDeg(clock.value) / 80) * 0.75 })); // the turning page darkens
  const chatDimStyle = useAnimatedStyle(() => ({ opacity: closing.value ? 0 : Math.max(0, 1 - pageDeg(clock.value) / 70) * 0.55 })); // the chat brightens as it's uncovered
  const chatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: slide.value * g.H }] }));

  const open = useCallback(() => new Promise<void>((done) => {
    side.value = techyDock.side === 'left' ? -1 : 1;
    closing.value = 0; home.value = 0; tuckBack.value = 0; slide.value = 0;
    setStill(true); setMood('cheer'); // one face for the whole move: nothing redraws Techy mid-flight
    let finished = false;
    const finish = () => { if (finished) return; finished = true; setStill(false); setMood('wave'); done(); };
    if (reduced) { clock.value = TOTAL; finish(); return; }
    clock.value = 0;
    clock.value = withTiming(TOTAL, { duration: TOTAL, easing: Easing.linear }, () => scheduleOnRN(finish));
    setTimeout(finish, TOTAL + 400); // same safety as run(): Back always works once the opening is over
  }), [reduced, side, clock, closing, home, tuckBack, slide]);

  const close = useCallback(async () => {
    // Flatten the screen first, also with Reduce motion: once the chat is gone the screen's animated style is dropped,
    // but its last size stays. Left at the opening's end (narrowed to nothing) it was a blank screen (POCO, HyperOS).
    closing.value = 1;                                                       // the screen waits flat under the chat
    if (reduced) { slide.value = 1; return; }
    setStill(true); setMood('ready');
    slide.value = withTiming(1, { duration: 560, easing: Easing.inOut(Easing.cubic) }); // the chat slides down
    await run(home, 1, 620);                                                 // Techy goes straight home
    await run(tuckBack, 1, 320);                                             // and tucks in
  }, [reduced, closing, slide, home, tuckBack]);

  return { open, close, mood, still, hands, techyStyle, screenStyle, shadeStyle, chatDimStyle, chatStyle };
}
