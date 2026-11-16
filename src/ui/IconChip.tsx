// IconChip: the rounded square behind an icon. Blue on light blue (one identity for every area); `neutral` is
// dark on soft grey for settings lists (Profile), `danger` is red for Sign out.
import React from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTokens } from './useTokens';

type Props = { icon: React.ComponentProps<typeof Feather>['name']; size?: 'sm' | 'md' | 'lg'; tone?: 'brand' | 'neutral' | 'danger' };
const SIZES = { sm: { box: 34, icon: 17, r: 10 }, md: { box: 40, icon: 20, r: 12 }, lg: { box: 48, icon: 23, r: 15 } };

export default function IconChip({ icon, size = 'md', tone = 'brand' }: Props) {
  const { c } = useTokens();
  const s = SIZES[size];
  return (
    <View style={{ width: s.box, height: s.box, borderRadius: s.r, backgroundColor: tone === 'neutral' ? c.cardSoft : tone === 'danger' ? c.errorBg : c.tint, alignItems: 'center', justifyContent: 'center' }}>
      <Feather name={icon} size={s.icon} color={tone === 'neutral' ? c.ink : tone === 'danger' ? c.error : c.brand} />
    </View>
  );
}
