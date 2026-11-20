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
// Android: the phone's own haptics (like the keyboard's). expo-haptics' "light" impact there is a 12% strength buzz
// most motors can't even make, so nothing was felt. These follow the phone's "Touch feedback" setting.
const android = Platform.OS === 'android';
export const haptic = {
  tap: () => { if (canBuzz()) (android ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Virtual_Key) : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)).catch(() => {}); },
  success: () => { if (canBuzz()) (android ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm) : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)).catch(() => {}); },
  error: () => { if (canBuzz()) (android ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject) : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)).catch(() => {}); },
};
