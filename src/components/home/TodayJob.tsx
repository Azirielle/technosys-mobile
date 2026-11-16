// "Today's job" on Home: the client, time and work type, the address, and two buttons: Details (the full
// dispatch sheet) and Navigate. With no job today it says so plainly and points to the Jobs tab.
import React from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useT } from '../../lib/i18n';
import { openDirections } from '../../lib/directions';
import type { Job } from '../../lib/jobs';
import WorkTag from '../jobs/WorkTag';
import { timeRange } from '../jobs/jobWords';
import { Button, Card, IconChip, StatusText, Txt, useTokens } from '../../ui';

type Props = { job: Job | null; onDetails: () => void; onAllJobs: () => void };

export default function TodayJob({ job, onDetails, onAllJobs }: Props) {
  const t = useT();
  const { c } = useTokens();
  if (!job) {
    return (
      <Card onPress={onAllJobs} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} accessibilityLabel={t('home.noJob')}>
        <IconChip icon="briefcase" />
        <View style={{ flex: 1 }}>
          <Txt variant="body">{t('home.noJob')}</Txt>
          <Txt variant="caption" color="ink2">{t('home.seeJobs')}</Txt>
        </View>
        <Feather name="chevron-right" size={18} color={c.ink3} />
      </Card>
    );
  }
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <IconChip icon="wind" />
        <View style={{ flex: 1, gap: 3 }}>
          <Txt variant="heading">{job.client_name}</Txt>
          <Txt variant="caption" color="ink2">{timeRange(job)}</Txt>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <WorkTag assignmentType={job.assignment_type} />
            {job.is_vip_hook && <StatusText tone="pending" label={t('jobs.vip')} />}
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Feather name="map-pin" size={15} color={c.ink2} style={{ marginTop: 2 }} />
        <Txt variant="body" color="ink2" style={{ flex: 1, fontSize: 14 }} numberOfLines={2}>{job.location}</Txt>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Button size="md" kind="secondary" label={t('home.details')} onPress={onDetails} /></View>
        <View style={{ flex: 1 }}><Button size="md" icon="navigation" label={t('jobs.navigate')} onPress={() => openDirections(job.geofence_lat, job.geofence_lon, job.location)} /></View>
      </View>
    </Card>
  );
}
