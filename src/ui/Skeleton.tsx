// Skeletons (motion #9): grey shapes the size of the real content with a soft light sweeping across every
// 1.2 s. Use them instead of spinners or blank screens. `useShowSkeleton` waits 150 ms so fast loads don't flash.
import React, { useEffect, useState } from 'react';
import { DimensionValue, StyleProp, View, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useReducedMotion } from './motion';
import { useTokens } from './useTokens';

export function Skeleton({ width = '100%', height = 16, radius = 10, style }: { width?: DimensionValue; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const { c, isDark } = useTokens();
  const reduced = useReducedMotion();
  const x = useSharedValue(-1);
  const w = useSharedValue(0);
  useEffect(() => {
    if (!reduced) x.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }), -1, false);
  }, [reduced, x]);
  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * w.value }] }));
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      onLayout={(e) => { w.value = e.nativeEvent.layout.width; }}
      style={[{ width, height, borderRadius: radius, backgroundColor: c.cardSoft, overflow: 'hidden' }, style]}>
      {!reduced && (
        <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }, sweep]}>
          <LinearGradient
            colors={['transparent', isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.75)', 'transparent']}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }}
          />
        </Animated.View>
      )}
    </View>
  );
}

/** A few lines of text, the last one shorter. */
export function SkeletonText({ lines = 2 }: { lines?: number }) {
  return (
    <View style={{ gap: 8 }}>
      {Array.from({ length: lines }, (_, i) => <Skeleton key={i} height={12} width={i === lines - 1 ? '60%' : '100%'} />)}
    </View>
  );
}

/** The shape of a ListRow. */
export function SkeletonRow() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14 }}>
      <Skeleton width={34} height={34} radius={10} />
      <View style={{ flex: 1, gap: 6 }}><Skeleton height={13} width="70%" /><Skeleton height={10} width="40%" /></View>
    </View>
  );
}

/** The shape of a card with a title and two lines. */
export function SkeletonCard({ height = 96 }: { height?: number }) {
  const { radius } = useTokens();
  return <Skeleton height={height} radius={radius.card} />;
}

/** True only after `loading` has lasted 150 ms, so quick loads never flash a skeleton. */
export function useShowSkeleton(loading: boolean, delay = 150) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!loading) { setShow(false); return; }
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [loading, delay]);
  return show;
}
