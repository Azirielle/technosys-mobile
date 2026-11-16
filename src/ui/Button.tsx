// Button: primary (filled blue, one per screen), secondary (outline), ghost (text only) and danger.
// Shows a small spinner while `loading`. Main actions get a light haptic tap.
import React from 'react';
import { ActivityIndicator, StyleProp, View, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import PressableScale from './PressableScale';
import Txt from './Txt';
import { useTokens } from './useTokens';

type Kind = 'primary' | 'secondary' | 'ghost' | 'danger';
type Props = {
  label: string;
  onPress?: () => void;
  kind?: Kind;
  size?: 'md' | 'lg';
  icon?: React.ComponentProps<typeof Feather>['name'];
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function Button({ label, onPress, kind = 'primary', size = 'lg', icon, loading, disabled, style }: Props) {
  const { c, radius } = useTokens();
  const looks = {
    primary: { bg: c.brand, fg: c.onBrand, border: 'transparent' },
    secondary: { bg: c.card, fg: c.ink, border: c.line },
    ghost: { bg: 'transparent', fg: c.brand, border: 'transparent' },
    danger: { bg: c.errorBg, fg: c.error, border: 'transparent' },
  }[kind];
  const off = disabled || loading;

  return (
    <PressableScale
      onPress={off ? undefined : onPress}
      haptic={kind === 'primary'}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={[
        {
          height: size === 'lg' ? 54 : 44,
          borderRadius: radius.control,
          backgroundColor: looks.bg,
          borderWidth: kind === 'secondary' ? 1 : 0,
          borderColor: looks.border,
          paddingHorizontal: 18,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={looks.fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon && <Feather name={icon} size={18} color={looks.fg} />}
          <Txt variant={size === 'lg' ? 'heading' : 'label'} style={{ color: looks.fg }}>{label}</Txt>
        </View>
      )}
    </PressableScale>
  );
}
