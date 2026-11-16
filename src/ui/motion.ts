// Motion presets (docs/ui-library/motion.md), built on react-native-reanimated so they run on the UI thread.
// Every preset respects the phone's "Reduce motion" setting: animations become plain quick fades or nothing.
import { useCallback } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Easing, FadeIn, FadeInDown, FadeOut, LinearTransition, useReducedMotion,
  useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { duration, spring, stagger } from './tokens';

export { useReducedMotion };
export const easeOut = Easing.out(Easing.cubic);

/** Motion #4: items arriving one after another (fade in and rise 8 px). Only the first 6 are delayed. */
export function arrive(index: number, reduced: boolean) {
  if (reduced) return FadeIn.duration(duration.quick);
  return FadeInDown.duration(duration.base)
    .delay(Math.min(index, stagger.max) * stagger.step)
    .withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] })
    .easing(easeOut);
}
export const leave = FadeOut.duration(duration.quick);
export const layout = LinearTransition.duration(duration.base).easing(easeOut);

/** Motion #1: shrink to 97% while pressed, spring back. Returns the animated style and press handlers. */
export function usePressScale(to = 0.97) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const onPressIn = useCallback(() => {
    if (!reduced) scale.value = withTiming(to, { duration: duration.instant });
  }, [reduced, to, scale]);
  const onPressOut = useCallback(() => {
    if (!reduced) scale.value = withSpring(1, spring);
  }, [reduced, scale]);
  return { style, onPressIn, onPressOut };
}

/** Haptics (motion.md): light tap on main actions, success and error. Silent where unsupported. */
export const haptic = {
  tap: () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); },
  success: () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
  error: () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); },
};
