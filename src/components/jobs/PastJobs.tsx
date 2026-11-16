// "Earlier jobs" on the Jobs tab: a compact list in one card (date and time, client, Done), no expanding.
// Past jobs only need a glance, so they take less room than upcoming ones.
import React from 'react';
import { View } from 'react-native';
import { useT } from '../../lib/i18n';
import type { Job } from '../../lib/jobs';
import { Card, StatusText, Txt, useTokens } from '../../ui';
import { dateOf, timeOf } from './jobWords';

export default function PastJobs({ jobs }: { jobs: Job[] }) {
  const t = useT();
  const { c } = useTokens();
  return (
    <Card padded={false}>
      {jobs.map((j, i) => (
        <View key={j.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: i === jobs.length - 1 ? 0 : 1, borderBottomColor: c.line }}>
          <View style={{ width: 74 }}>
            <Txt variant="caption" color="ink2">{dateOf(j.start_time)}</Txt>
            <Txt variant="caption" color="ink3">{timeOf(j.start_time)}</Txt>
          </View>
          <Txt variant="body" style={{ flex: 1, fontSize: 15 }} numberOfLines={1}>{j.client_name}</Txt>
          {j.status === 'completed' && <StatusText tone="ok" label={t('jobs.statusDone')} />}
        </View>
      ))}
    </Card>
  );
}
