// "Today's job" on Home: the client, time and work type, the address, and two buttons: Details (the full
// dispatch sheet) and Navigate, plus your time-in status on it (working since / done for today).
// With no job at all Home shows no card here: the time-in card says "No schedule today".
import React from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useT } from '../../lib/i18n';
import { openDirections } from '../../lib/directions';
import type { Job } from '../../lib/jobs';
import type { ShiftState } from './TimeInCard';
import WorkTag from '../jobs/WorkTag';
import { timeRange } from '../jobs/jobWords';
import { Button, Card, IconChip, StatusText, Txt, useTokens } from '../../ui';

type Props = { job: Job; shift?: ShiftState; onDetails: () => void };

export default function TodayJob({ job, shift, onDetails }: Props) {
  const t = useT();
  const { c } = useTokens();
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
          {shift?.kind === 'working' && <StatusText tone={shift.verified ? 'ok' : 'pending'} label={t('home.working', { time: clock(shift.startedAt) })} />}
          {shift?.kind === 'done' && <StatusText tone="info" label={t('home.doneToday')} />}
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

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
