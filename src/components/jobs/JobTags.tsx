// The small tags under a job's name: work type, VIP squeeze-in, and the latest office change.
import React from 'react';
import { View } from 'react-native';
import { useT } from '../../lib/i18n';
import type { Job, JobChange } from '../../lib/jobs';
import { StatusText } from '../../ui';
import WorkTag from './WorkTag';
import { changeBadge } from './jobWords';

export default function JobTags({ job, change, done }: { job: Job; change?: JobChange; done?: boolean }) {
  const t = useT();
  const badge = change ? changeBadge(change, t) : null;
  return (
    <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 2 }}>
      <WorkTag assignmentType={job.assignment_type} />
      {job.is_vip_hook && <StatusText tone="pending" label={t('jobs.vip')} />}
      {badge && <StatusText tone={badge.tone} label={badge.label} />}
      {done && <StatusText tone="ok" label={t('jobs.statusDone')} />}
    </View>
  );
}
