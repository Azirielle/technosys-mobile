// The top of the DTR tab: counted hours this cut-off, how many workdays you showed up for so far, and
// overtime and night-shift hours underneath. One big number, everything else small.
import React from 'react';
import { View } from 'react-native';
import { useT } from '../../lib/i18n';
import type { DtrResult } from '../../lib/dtr';
import { Card, Txt, useTokens } from '../../ui';
import { n1 } from './dayTags';

export default function DtrHero({ dtr }: { dtr: DtrResult }) {
  const t = useT();
  const { c } = useTokens();
  const share = dtr.workdaysSoFar ? Math.min(1, dtr.present / dtr.workdaysSoFar) : 0;
  const mini = (label: string, value: string) => (
    <View style={{ flex: 1 }}>
      <Txt variant="heading">{value}</Txt>
      <Txt variant="caption" color="ink2">{label}</Txt>
    </View>
  );
  return (
    <Card>
      <Txt variant="caption" color="ink2">{t('dtr.counted')}</Txt>
      <Txt variant="display" accessibilityLabel={t('dtr.countedA11y', { n: n1(dtr.worked) })}>{n1(dtr.worked)} h</Txt>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: c.cardSoft, marginTop: 10, overflow: 'hidden' }}>
        <View style={{ width: `${share * 100}%`, height: 6, borderRadius: 3, backgroundColor: c.accent }} />
      </View>
      <Txt variant="caption" color="ink2" style={{ marginTop: 6 }}>{t('dtr.showedUp', { n: dtr.present, of: dtr.workdaysSoFar, all: dtr.workdays })}</Txt>
      <View style={{ flexDirection: 'row', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.line }}>
        {mini(t('dtr.overtimeApproved'), `${n1(dtr.ot)} h`)}
        {mini(t('dtr.nightShift'), `${n1(dtr.night)} h`)}
      </View>
    </Card>
  );
}
