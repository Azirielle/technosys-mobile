// Techy, the TechnoSys mascot: a friendly aircon unit with a wrench (motion #14).
// Alive: breathes (slow float), blinks every 3–6 s, air flows from its vents.
// Moods: ready (smile), cheer (open smile + hop + wave), wave (smile + wave), worry (small frown), rest (eyes closed).
// With "Reduce motion" Techy is still and only its face changes. `still` (while it moves across the screen) stops the
// breathing and mood motions too, so Techy doesn't jitter in flight. `hands` (0..1) makes it hold something with both
// arms: a second arm like its own grows in front, and its wrench arm swings over behind its body (motion #15).
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Rect, Path, Ellipse, Circle, G } from 'react-native-svg';
import Animated, {
  Easing, cancelAnimation, useAnimatedProps, useAnimatedStyle, useSharedValue,
  withRepeat, withSequence, withSpring, withTiming, type DerivedValue,
} from 'react-native-reanimated';
import { useReducedMotion } from './motion';
import { useTokens } from './useTokens';

export type TechyMood = 'ready' | 'cheer' | 'wave' | 'worry' | 'rest';

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const W = 120, H = 110; // drawing size

type Props = { mood?: TechyMood; size?: number; still?: boolean; hands?: DerivedValue<number> };

/** A second arm, the same design as Techy's own (mirrored): a line and the wrench-shaped hand. */
const ExtraArm = ({ color }: { color: string }) => (
  <>
    <Path d="M16 40 l-11 -12" stroke={color} strokeWidth={3} strokeLinecap="round" />
    <Path d="M9 20 l-8 4 3 7 8 -3z" fill={color} />
  </>
);

export default function Techy({ mood = 'ready', size = 96, still = false, hands }: Props) {
  const { c } = useTokens();
  const reduced = useReducedMotion();
  const float = useSharedValue(0);
  const hop = useSharedValue(0);
  const arm = useSharedValue(0);
  const eye = useSharedValue(1);
  const air = useSharedValue(0);

  // Breathing and air: always on (unless reduce motion)
  useEffect(() => {
    if (reduced || still) { float.value = withTiming(0, { duration: 120 }); return; }
    float.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true);
    air.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.linear }), -1, false);
    return () => { cancelAnimation(float); cancelAnimation(air); };
  }, [reduced, still, float, air]);

  // Blink every 3–6 s
  useEffect(() => {
    if (reduced || mood === 'rest') return;
    let timer: ReturnType<typeof setTimeout>;
    const blink = () => {
      timer = setTimeout(() => {
        eye.value = withSequence(withTiming(0.12, { duration: 70 }), withTiming(1, { duration: 90 }));
        blink();
      }, 3000 + Math.random() * 3000);
    };
    blink();
    return () => clearTimeout(timer);
  }, [reduced, mood, eye]);

  // Mood reactions
  useEffect(() => {
    if (reduced || still) return;
    if (mood === 'cheer') hop.value = withSequence(withSpring(-9, { damping: 6, stiffness: 300 }), withSpring(0), withSpring(-6, { damping: 6, stiffness: 300 }), withSpring(0));
    if (mood === 'cheer' || mood === 'wave') {
      arm.value = withSequence(...[-18, 8, -12, 6, -10, 0].map((deg) => withTiming(deg, { duration: 150 })));
    }
  }, [mood, reduced, still, hop, arm]);

  const body = useAnimatedStyle(() => ({ transform: [{ translateY: hop.value - float.value * 2.5 }] }));
  // Holding: the wrench arm swings over (and out of sight) to become the far hand
  const armStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${arm.value - (hands?.value ?? 0) * 40}deg` }, { scale: 1 - (hands?.value ?? 0) }] }));
  const holdStyle = useAnimatedStyle(() => ({ transform: [{ scale: hands?.value ?? 0 }] }));
  const eyeL = useAnimatedProps(() => ({ ry: (mood === 'worry' ? 4.5 : 5.5) * eye.value }));
  const eyeR = useAnimatedProps(() => ({ ry: (mood === 'worry' ? 4.5 : 5.5) * eye.value }));
  const breeze = useAnimatedProps(() => ({ strokeDashoffset: -air.value * 20 }));

  const s = size / W;
  const ink = c.ink;
  return (
    <View style={{ width: size, height: (size * H) / W }} accessibilityRole="image" accessibilityLabel="Techy">
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, width: size, height: (size * H) / W }, body]}>
        {hands && (
          // The far hand, behind the body: the body covers about half of it, its grip still shows
          <Animated.View style={[{ position: 'absolute', width: size, height: (size * H) / W, transformOrigin: [30 * s, 34 * s, 0] }, holdStyle]}>
            <Svg width={size} height={(size * H) / W} viewBox={`0 0 ${W} ${H}`}><G transform="translate(14 -6) rotate(-38 16 40)"><ExtraArm color={c.brand} /></G></Svg>
          </Animated.View>
        )}
        <Svg width={size} height={(size * H) / W} viewBox={`0 0 ${W} ${H}`}>
          <Rect x={14} y={18} width={92} height={50} rx={18} fill={c.card} stroke={c.brand} strokeWidth={3} />
          <Path d="M26 56h68" stroke={c.brand} strokeWidth={2.5} strokeLinecap="round" opacity={0.45} />
          {mood === 'rest' ? (
            <Path d="M38 37 q6 4 12 0 M70 37 q6 4 12 0" stroke={ink} strokeWidth={3} fill="none" strokeLinecap="round" />
          ) : (
            <G>
              <AnimatedEllipse cx={44} cy={37} rx={5} ry={5.5} fill={ink} animatedProps={eyeL} />
              <AnimatedEllipse cx={76} cy={37} rx={5} ry={5.5} fill={ink} animatedProps={eyeR} />
            </G>
          )}
          {mood === 'cheer' && <Path d="M49 44 q11 13 22 0 z" fill={ink} stroke={ink} strokeWidth={3} strokeLinejoin="round" />}
          {(mood === 'ready' || mood === 'wave' || mood === 'rest') && <Path d="M51 45 q9 8 18 0" stroke={ink} strokeWidth={3} fill="none" strokeLinecap="round" />}
          {mood === 'worry' && <Path d="M52 49 q8 -5 16 0" stroke={ink} strokeWidth={3} fill="none" strokeLinecap="round" />}
          <Circle cx={34} cy={46} r={4.5} fill={c.errorBg} />
          <Circle cx={86} cy={46} r={4.5} fill={c.errorBg} />
        </Svg>
        {hands && (
          // The near hand, in front of the body
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: (size * H) / W, transformOrigin: [18 * s, 54 * s, 0] }, holdStyle]}>
            <Svg width={size} height={(size * H) / W} viewBox={`0 0 ${W} ${H}`}><G transform="translate(2 14) rotate(-46 16 40)"><ExtraArm color={c.brand} /></G></Svg>
          </Animated.View>
        )}
        {/* The arm and wrench turn around the shoulder, so they are drawn on their own layer */}
        <Animated.View style={[{ position: 'absolute', left: 100 * s, top: 14 * s, width: 22 * s, height: 30 * s, transformOrigin: [4 * s, 26 * s, 0] }, armStyle]}>
          <Svg width={22 * s} height={30 * s} viewBox="100 14 22 30">
            <Path d="M104 40 l11 -12" stroke={c.brand} strokeWidth={3} strokeLinecap="round" />
            <Path d="M111 20 l8 4 -3 7 -8 -3z" fill={c.brand} />
          </Svg>
        </Animated.View>
      </Animated.View>
      <Svg width={size} height={(size * H) / W} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
        <AnimatedPath
          d="M34 74 q-3 8 1 14 M60 74 v15 M86 74 q3 8 -1 14"
          stroke={c.accent} strokeWidth={3} fill="none" strokeLinecap="round" strokeDasharray="4 6"
          opacity={mood === 'rest' ? 0.5 : 1} animatedProps={breeze}
        />
      </Svg>
    </View>
  );
}
