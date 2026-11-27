// Motion presets (docs/ui-library/motion.md), built on react-native-reanimated so they run on the UI thread.
// Every preset respects the phone's "Reduce motion" setting: animations become plain quick fades or nothing.
import { useCallback } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Easing, FadeIn, FadeInDown, FadeOut, LinearTransition, useReducedMotion,
  useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { duration, spring } from './tokens';

export { useReducedMotion };
export const easeOut = Easing.out(Easing.cubic);

/**
 * Motion #4: content arriving (fade in and rise 6 px). Everything on a screen arrives TOGETHER, at the same
 * moment: Andrew's feedback (16 Nov) was that items appearing one after another felt delayed. The `index`
 * is kept so callers don't change, but no longer adds a delay.
 */
export function arrive(_index: number, reduced: boolean) {
  if (reduced) return FadeIn.duration(duration.quick);
  return FadeInDown.duration(duration.base)
    .withInitialValues({ opacity: 0, transform: [{ translateY: 6 }] })
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
// Every vibration in the app goes through here, so Profile → "Vibrate on tap" can turn them all off.
let hapticsOn = true;
export function setHapticsEnabled(on: boolean) { hapticsOn = on; }
const canBuzz = () => hapticsOn && Platform.OS !== 'web';
// Android: the vibration motor directly. The phone's own touch haptics stayed silent on POCO phones (HyperOS turns
// them off with its haptic setting), and the "light" impact is a buzz too weak to feel, so taps use "medium".
const android = Platform.OS === 'android';
export const haptic = {
  tap: () => { if (canBuzz()) Haptics.impactAsync(android ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {}); },
  success: () => { if (canBuzz()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
  error: () => { if (canBuzz()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); },
};
