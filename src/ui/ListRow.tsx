// ListRow: icon chip, title, optional subtitle, and something on the right (a status, a value or a chevron).
// Put several inside a <Card padded={false}> to make a list; `last` hides the divider.
// `look="settings"` is the Profile style: grey icon squares, no dividers, a value before the chevron (`value`);
// `danger` makes the row red (Sign out).
import React from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import IconChip from './IconChip';
import PressableScale from './PressableScale';
import Txt from './Txt';
import { useTokens } from './useTokens';
import { fonts } from './tokens';

type Props = {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
  look?: 'default' | 'settings';
  value?: string;
  danger?: boolean;
  leading?: React.ReactNode; // replaces the icon chip (a tool photo, an avatar)
  /** Inbox read state, like a chat app: true = highlighted and bold, false = greyed. Leave out for other lists. */
  unread?: boolean;
};

export default function ListRow({ icon, title, subtitle, right, onPress, last, look = 'default', value, danger, leading, unread }: Props) {
  const { c } = useTokens();
  const settings = look === 'settings';
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: settings ? 7 : 11, paddingHorizontal: 14, borderBottomWidth: last || settings ? 0 : 1, borderBottomColor: c.line, backgroundColor: unread ? c.infoBg : undefined, opacity: unread === false ? 0.7 : 1 }}>
      {leading ?? <IconChip icon={icon} size={settings ? 'md' : 'sm'} tone={danger ? 'danger' : settings ? 'neutral' : 'brand'} />}
      <View style={{ flex: 1 }}>
        <Txt variant="body" numberOfLines={1} style={[danger && { color: c.error }, unread && { fontFamily: fonts.semibold }, unread === false && { color: c.ink2 }]}>{title}</Txt>
        {!!subtitle && <Txt variant="caption" color="ink2" numberOfLines={1}>{subtitle}</Txt>}
      </View>
      {!!value && <Txt variant="body" color="ink2" numberOfLines={1} style={{ fontSize: 14, maxWidth: '45%' }}>{value}</Txt>}
      {right ?? (onPress && !danger ? <Feather name="chevron-right" size={18} color={c.ink3} /> : null)}
    </View>
  );
  return onPress ? <PressableScale onPress={onPress} scaleTo={0.985} accessibilityRole="button" accessibilityLabel={title}>{body}</PressableScale> : body;
}
