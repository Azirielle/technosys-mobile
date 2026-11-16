// ChoiceCard (motion #2): a card you pick. When selected its background fills with light blue, the border
// turns blue and a check pops in. Used for language, leave type, tool problem and filter choices.
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { ZoomIn, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import Txt from './Txt';
import { useReducedMotion } from './motion';
import { duration } from './tokens';
import { useTokens } from './useTokens';

type Props = {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Feather>['name'];
  big?: boolean;
};

export default function ChoiceCard({ title, subtitle, selected, onPress, icon, big }: Props) {
  const { c, radius } = useTokens();
  const reduced = useReducedMotion();
  const on = useSharedValue(selected ? 1 : 0);
  useEffect(() => { on.value = withTiming(selected ? 1 : 0, { duration: reduced ? 0 : duration.base }); }, [selected, reduced, on]);
  const look = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [c.card, c.tint]),
    borderColor: interpolateColor(on.value, [0, 1], [c.line, c.brand]),
  }));

  return (
    <PressableScale onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={title}>
      <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: big ? 20 : 16, borderRadius: radius.card, borderWidth: 2 }, look]}>
        {icon && <Feather name={icon} size={22} color={selected ? c.brand : c.ink2} />}
        <View style={{ flex: 1 }}>
          <Txt variant={big ? 'title' : 'heading'} style={big ? { fontSize: 20 } : undefined}>{title}</Txt>
          {!!subtitle && <Txt variant="body" color="ink2" style={{ fontSize: 14 }}>{subtitle}</Txt>}
        </View>
        <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: selected ? c.brand : c.line, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? c.brand : 'transparent' }}>
          {selected && <Animated.View entering={reduced ? undefined : ZoomIn.springify().damping(12)}><Feather name="check" size={16} color={c.onBrand} /></Animated.View>}
        </View>
      </Animated.View>
    </PressableScale>
  );
}
