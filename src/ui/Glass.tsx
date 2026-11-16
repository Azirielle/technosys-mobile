// Glass: frosted white over the glow (time-in card, tab bar, sheets). Real blur on iOS and on Android 12+;
// older Android phones get plain translucent white instead (expo-blur 'dimezisBlurViewSdk31Plus'),
// so it never slows a cheap phone down. Lists and reading cards use <Card>, not glass.
import React from 'react';
import { Platform, StyleProp, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useGlowTarget } from './Glow';
import { useTokens } from './useTokens';

type Props = { children: React.ReactNode; style?: StyleProp<ViewStyle>; radius?: number; intensity?: number };

export default function Glass({ children, style, radius, intensity = 40 }: Props) {
  const { c, isDark, radius: r } = useTokens();
  const target = useGlowTarget();
  const corner = radius ?? r.card;
  return (
    <View style={[{ borderRadius: corner, overflow: 'hidden', borderWidth: 1, borderColor: c.glassLine }, style]}>
      <BlurView
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        intensity={intensity}
        tint={isDark ? 'dark' : 'light'}
        blurMethod={target ? 'dimezisBlurViewSdk31Plus' : 'none'}
        blurTarget={target ?? undefined}
      />
      {/* Without blur behind it (Android, no glow) plain glass is too see-through over text: use near-solid card */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: !target && Platform.OS === 'android' ? c.card : c.glass, opacity: !target && Platform.OS === 'android' ? 0.96 : 1 }} />
      {children}
    </View>
  );
}
