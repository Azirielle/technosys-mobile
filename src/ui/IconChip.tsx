// IconChip: the rounded square behind an icon. Always blue on light blue: one identity for every area.
import React from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTokens } from './useTokens';

type Props = { icon: React.ComponentProps<typeof Feather>['name']; size?: 'sm' | 'md' | 'lg' };
const SIZES = { sm: { box: 34, icon: 17, r: 10 }, md: { box: 40, icon: 20, r: 12 }, lg: { box: 48, icon: 23, r: 15 } };

export default function IconChip({ icon, size = 'md' }: Props) {
  const { c } = useTokens();
  const s = SIZES[size];
  return (
    <View style={{ width: s.box, height: s.box, borderRadius: s.r, backgroundColor: c.tint, alignItems: 'center', justifyContent: 'center' }}>
      <Feather name={icon} size={s.icon} color={c.brand} />
    </View>
  );
}
