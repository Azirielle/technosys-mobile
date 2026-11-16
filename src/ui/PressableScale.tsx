// PressableScale: anything tappable. Shrinks to 97% while pressed and springs back (motion #1);
// `haptic` adds a light tap for main actions.
import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressScale, haptic as haptics } from './motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; haptic?: boolean; scaleTo?: number };

export default function PressableScale({ style, haptic, scaleTo, onPress, onPressIn, onPressOut, ...rest }: Props) {
  const press = usePressScale(scaleTo);
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => { press.onPressIn(); onPressIn?.(e); }}
      onPressOut={(e) => { press.onPressOut(); onPressOut?.(e); }}
      onPress={(e) => { if (haptic) haptics.tap(); onPress?.(e); }}
      style={[style, press.style]}
    />
  );
}
