// Txt: every piece of text in the app. Pick a size from the type scale and a color from the palette.
import React from 'react';
import { Text, TextProps } from 'react-native';
import { useTokens } from './useTokens';
import type { Palette, TypeName } from './tokens';

type Props = TextProps & { variant?: TypeName; color?: keyof Palette; center?: boolean };

export default function Txt({ variant = 'body', color = 'ink', center, style, ...rest }: Props) {
  const { c, type } = useTokens();
  return <Text {...rest} style={[type[variant], { color: c[color] }, center && { textAlign: 'center' }, style]} />;
}
