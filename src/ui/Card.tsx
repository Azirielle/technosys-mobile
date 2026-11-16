// Card: the white rounded card. With onPress it becomes tappable with the press feedback (motion #1).
import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import PressableScale from './PressableScale';
import { useTokens } from './useTokens';

type Props = { children: React.ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; padded?: boolean; accessibilityLabel?: string };

export default function Card({ children, onPress, style, padded = true, accessibilityLabel }: Props) {
  const { c, radius, shadow, isDark } = useTokens();
  const look: ViewStyle = {
    backgroundColor: c.card,
    borderRadius: radius.card,
    padding: padded ? 14 : 0,
    borderWidth: isDark ? 1 : 0,
    borderColor: c.line,
    ...shadow.card,
  };
  if (onPress) {
    return (
      <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={[look, style]}>
        {children}
      </PressableScale>
    );
  }
  return <View style={[look, style]}>{children}</View>;
}
