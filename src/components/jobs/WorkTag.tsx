// WorkTag: the small "On-site / Out of town / Office HQ" tag on jobs and DTR days.
import React from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useT } from '../../lib/i18n';
import { workTypeOf } from '../../lib/jobs';
import { Txt, useTokens } from '../../ui';

const WORK_ICON = { onSite: 'map-pin', outOfTown: 'truck', officeHq: 'home' } as const;

export default function WorkTag({ assignmentType }: { assignmentType: string | null }) {
  const { c } = useTokens();
  const t = useT();
  const kind = workTypeOf(assignmentType);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: c.tint, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
      <Feather name={WORK_ICON[kind]} size={12} color={c.brand} />
      <Txt variant="label" style={{ fontSize: 11, color: c.brand }}>{t(`jobs.${kind}`)}</Txt>
    </View>
  );
}
