// SuccessCheck (motion #10): a green circle pops in, the check draws itself, a soft ring spreads out,
// and the phone gives a success buzz. Mount it (or change `playKey`) to play. With "Reduce motion"
// the check simply appears.
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { haptic, useReducedMotion } from './motion';
import { duration, spring } from './tokens';
import { useTokens } from './useTokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const CHECK_LENGTH = 40;

export default function SuccessCheck({ size = 56, playKey = 0 }: { size?: number; playKey?: number | string }) {
  const { c } = useTokens();
  const reduced = useReducedMotion();
  const pop = useSharedValue(reduced ? 1 : 0.4);
  const draw = useSharedValue(reduced ? 0 : CHECK_LENGTH);
  const ring = useSharedValue(0);

  useEffect(() => {
    haptic.success();
    if (reduced) return;
    pop.value = 0.4; draw.value = CHECK_LENGTH; ring.value = 0;
    pop.value = withSpring(1, spring);
    draw.value = withDelay(80, withTiming(0, { duration: duration.slow, easing: Easing.out(Easing.cubic) }));
    ring.value = withSequence(withTiming(0, { duration: 60 }), withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }));
  }, [playKey, reduced, pop, draw, ring]);

  const circle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const burst = useAnimatedStyle(() => ({ opacity: 0.45 * (1 - ring.value), transform: [{ scale: 1 + ring.value * 0.8 }] }));
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: draw.value }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Saved" accessibilityRole="image">
      <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: c.ok }, burst]} />
      <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.ok, alignItems: 'center', justifyContent: 'center' }, circle]}>
        <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 32 32">
          <AnimatedPath
            d="M7 17 l6 6 l12 -13"
            stroke={c.card} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none"
            strokeDasharray={CHECK_LENGTH} animatedProps={checkProps}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}
