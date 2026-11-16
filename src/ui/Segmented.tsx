// Segmented: a small switch between 2–3 choices (Light / Dark / Same as phone). The white thumb slides to the
// chosen option with a spring.
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Txt from './Txt';
import { haptic, useReducedMotion } from './motion';
import { spring } from './tokens';
import { useTokens } from './useTokens';

type Option<T extends string> = { value: T; label: string };

export default function Segmented<T extends string>({ options, value, onChange, label }: { options: Option<T>[]; value: T; onChange: (v: T) => void; label: string }) {
  const { c, shadow, isDark } = useTokens();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const slot = (width - 8) / options.length;
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useSharedValue(0);
  useEffect(() => { if (slot > 0) x.value = reduced ? withTiming(index * slot, { duration: 0 }) : withSpring(index * slot, spring); }, [index, slot, reduced, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', backgroundColor: c.cardSoft, borderRadius: 14, padding: 4 }}>
      {slot > 0 && <Animated.View style={[{ position: 'absolute', top: 4, bottom: 4, left: 4, width: slot, borderRadius: 11, backgroundColor: isDark ? c.line : c.card }, shadow.card, thumb]} />}
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => { if (o.value !== value) { haptic.tap(); onChange(o.value); } }}
          accessibilityRole="radio" accessibilityState={{ selected: o.value === value }}
          style={{ flex: 1, height: 38, alignItems: 'center', justifyContent: 'center' }}>
          <Txt variant="label" style={{ color: o.value === value ? c.ink : c.ink2 }}>{o.label}</Txt>
        </Pressable>
      ))}
    </View>
  );
}
