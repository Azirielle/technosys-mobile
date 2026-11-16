// One line in the DTR day list: date, times, status words and counted hours. Tap opens that day's screen.
import React from 'react';
import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useT } from '../../lib/i18n';
import type { DtrDay } from '../../lib/dtr';
import { StatusText, Txt, useTokens } from '../../ui';
import { dayTags, n1 } from './dayTags';

export default function DtrDayRow({ day, onPress, last, onlyFirstTag }: { day: DtrDay; onPress: () => void; last?: boolean; onlyFirstTag?: boolean }) {
  const t = useT();
  const { c } = useTokens();
  const d = new Date(`${day.date}T00:00:00Z`);
  const tags = dayTags(day, t);
  const times = day.timeIn ? `${day.timeIn} – ${day.timeOut ?? (day.state === 'working' ? '…' : t('dtr.noTimeOut'))}` : null;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${d.toDateString()} ${tags.map((x) => x.label).join(', ')}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.line, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 38, alignItems: 'center' }}>
        <Txt variant="heading">{d.getUTCDate()}</Txt>
        <Txt variant="caption" color="ink2">{d.toLocaleDateString([], { weekday: 'short', timeZone: 'UTC' })}</Txt>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        {times ? <Txt variant="body" style={{ fontSize: 15 }}>{times}</Txt> : null}
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {(onlyFirstTag ? tags.slice(0, 1) : tags).map((x) => <StatusText key={x.key} tone={x.tone} label={x.label} />)}
        </View>
      </View>
      <Txt variant="label" style={{ color: day.hours ? c.ink : c.ink3 }}>{day.hours ? `${n1(day.hours)} h` : '—'}</Txt>
      <Feather name="chevron-right" size={18} color={c.ink3} />
    </Pressable>
  );
}
