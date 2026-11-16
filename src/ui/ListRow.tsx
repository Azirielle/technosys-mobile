// ListRow: icon chip, title, optional subtitle, and something on the right (a status, a value or a chevron).
// Put several inside a <Card padded={false}> to make a list; `last` hides the divider.
import React from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import IconChip from './IconChip';
import PressableScale from './PressableScale';
import Txt from './Txt';
import { useTokens } from './useTokens';

type Props = {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
};

export default function ListRow({ icon, title, subtitle, right, onPress, last }: Props) {
  const { c } = useTokens();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.line }}>
      <IconChip icon={icon} size="sm" />
      <View style={{ flex: 1 }}>
        <Txt variant="body" numberOfLines={1}>{title}</Txt>
        {!!subtitle && <Txt variant="caption" color="ink2" numberOfLines={1}>{subtitle}</Txt>}
      </View>
      {right ?? (onPress ? <Feather name="chevron-right" size={18} color={c.ink3} /> : null)}
    </View>
  );
  return onPress ? <PressableScale onPress={onPress} scaleTo={0.985} accessibilityRole="button" accessibilityLabel={title}>{body}</PressableScale> : body;
}
