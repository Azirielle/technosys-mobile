// TabBar (motion #6): the glass bottom bar for Home · Jobs · DTR · Profile. A light-blue pill slides under the
// active tab, a short cyan underline marks it, and the active icon grows a little. The pill moves the moment
// you tap (it doesn't wait for the screen to draw), in 200 ms with no bounce. Light haptic tap.
// Used by app/(tabs)/_layout.tsx.
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/tabs';
import Glass from './Glass';
import Txt from './Txt';
import { haptic, useReducedMotion } from './motion';
import { useTokens } from './useTokens';

export const TAB_BAR_HEIGHT = 70;
const SLIDE_MS = 200;
type IconName = React.ComponentProps<typeof Feather>['name'];

export default function TabBar({ state, descriptors, navigation, icons }: BottomTabBarProps & { icons: Record<string, IconName> }) {
  const { c } = useTokens();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const count = state.routes.length;
  const slot = width / Math.max(count, 1);
  const x = useSharedValue(0);
  // The tab you tapped, shown at once; it follows the navigator if the tab changes another way (Back, a link)
  const [active, setActive] = useState(state.index);
  useEffect(() => { setActive(state.index); }, [state.index]);
  const slideTo = (i: number) => { x.value = withTiming(i * slot, { duration: reduced ? 0 : SLIDE_MS, easing: Easing.out(Easing.cubic) }); };

  useEffect(() => { if (slot) slideTo(active); }, [active, slot, reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 12, right: 12, bottom: Math.max(insets.bottom, 10) }}>
      <Glass radius={26} intensity={50}>
        <View
          onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width - 12)}
          style={{ flexDirection: 'row', height: TAB_BAR_HEIGHT, paddingHorizontal: 6, alignItems: 'center' }}
          accessibilityRole="tablist"
        >
          {slot > 0 && (
            <Animated.View style={[{ position: 'absolute', left: 6, top: 8, bottom: 8, width: slot, alignItems: 'center' }, pill]}>
              <View style={{ flex: 1, width: slot - 10, borderRadius: 18, backgroundColor: c.tint }} />
              <View style={{ position: 'absolute', bottom: -2, width: 16, height: 3, borderRadius: 2, backgroundColor: c.accent }} />
            </Animated.View>
          )}
          {state.routes.map((route, i) => {
            const focused = active === i;
            const label = (descriptors[route.key].options.title ?? route.name) as string;
            return (
              <TabButton
                key={route.key}
                label={label}
                icon={icons[route.name] ?? 'circle'}
                focused={focused}
                onPress={() => {
                  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!focused && !event.defaultPrevented) {
                    haptic.tap();
                    setActive(i);
                    slideTo(i);
                    navigation.navigate(route.name, route.params);
                  }
                }}
              />
            );
          })}
        </View>
      </Glass>
    </View>
  );
}

function TabButton({ label, icon, focused, onPress }: { label: string; icon: IconName; focused: boolean; onPress: () => void }) {
  const { c } = useTokens();
  const reduced = useReducedMotion();
  const grow = useSharedValue(focused ? 1 : 0);
  useEffect(() => { grow.value = withTiming(focused ? 1 : 0, { duration: reduced ? 0 : SLIDE_MS, easing: Easing.out(Easing.cubic) }); }, [focused, reduced, grow]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -1 * grow.value }, { scale: 1 + 0.12 * grow.value }] }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={{ flex: 1, height: 54, alignItems: 'center', justifyContent: 'center', gap: 2 }}
    >
      <Animated.View style={iconStyle}>
        <Feather name={icon} size={22} color={focused ? c.brand : c.ink3} />
      </Animated.View>
      <Txt variant="label" style={{ fontSize: 11, color: focused ? c.brand : c.ink3 }}>{label}</Txt>
    </Pressable>
  );
}
