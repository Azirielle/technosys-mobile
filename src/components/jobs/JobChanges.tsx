// "What changed": the office's moves, cancellations, VIP squeeze-ins and crew changes from the last 7 days,
// newest first, each with the reason the office gave.
import React from 'react';
import { View } from 'react-native';
import { useT } from '../../lib/i18n';
import type { JobChange } from '../../lib/jobs';
import { Card, IconChip, Txt, useTokens } from '../../ui';
import { CHANGE_ICON, ago, changeSentence } from './jobWords';

export default function JobChanges({ changes }: { changes: JobChange[] }) {
  const t = useT();
  const { c } = useTokens();
  return (
    <Card padded={false}>
      {changes.map((ch, i) => (
        <View key={`${ch.jobId}-${ch.at}`} style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: i === changes.length - 1 ? 0 : 1, borderBottomColor: c.line }}>
          <IconChip icon={CHANGE_ICON[ch.kind]} size="sm" />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Txt variant="label" style={{ flex: 1 }} numberOfLines={1}>{ch.jobName}</Txt>
              <Txt variant="caption" color="ink3">{ago(ch.at, t)}</Txt>
            </View>
            <Txt variant="body" style={{ fontSize: 14, color: ch.kind === 'cancelled' ? c.error : c.ink }}>{changeSentence(ch, t)}</Txt>
            {!!ch.reason && <Txt variant="caption" color="ink2">{ch.reason}</Txt>}
          </View>
        </View>
      ))}
    </Card>
  );
}
