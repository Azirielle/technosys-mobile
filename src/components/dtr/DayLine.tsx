// One "label ........ value" line on a DTR day screen (Time in 8:02 AM, Meal break −1.0 h…).
import React from 'react';
import { View } from 'react-native';
import { Txt, useTokens } from '../../ui';

export default function DayLine({ label, value, note, strong, last }: { label: string; value: string; note?: string; strong?: boolean; last?: boolean }) {
  const { c } = useTokens();
  return (
    <View style={{ paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Txt variant={strong ? 'label' : 'body'} style={{ flex: 1, fontSize: 15 }}>{label}</Txt>
        <Txt variant={strong ? 'heading' : 'label'}>{value}</Txt>
      </View>
      {!!note && <Txt variant="caption" color="ink2" style={{ marginTop: 2 }}>{note}</Txt>}
    </View>
  );
}
