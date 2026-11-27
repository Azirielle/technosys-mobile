// A job on Home: the client, time and work type, the address, and two buttons: Details (the full dispatch sheet)
// and Navigate. Task 3 (27 Nov): today's job sits INSIDE the time-in card (`inside`), so the technician sees what
// they are timing in for; a later job is its own card under "Next job". An out-of-town job also shows
// "Day 3 of 5" with a bar filling toward the last day (`trip`). With no job at all Home shows no job here.
import React from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useT } from '../../lib/i18n';
import { openDirections } from '../../lib/directions';
import type { Job } from '../../lib/jobs';
import WorkTag from '../jobs/WorkTag';
import { timeRange } from '../jobs/jobWords';
import { Button, Card, IconChip, StatusText, Txt, useTokens } from '../../ui';

export type Trip = { day: number; days: number };
type Props = { job: Job; onDetails: () => void; inside?: boolean; trip?: Trip | null };

export default function TodayJob({ job, onDetails, inside, trip }: Props) {
  const t = useT();
  const { c } = useTokens();
  const body = (
    <>
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
      {trip && (
        <View style={{ gap: 4 }} accessibilityLabel={t('home.tripDay', trip)}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Txt variant="body" style={{ fontWeight: '600' }}>{t('home.tripDay', trip)}</Txt>
            <Txt variant="caption" color="ink2">{trip.day >= trip.days ? t('home.tripLast') : t(trip.days - trip.day === 1 ? 'home.tripLeftOne' : 'home.tripLeft', { n: trip.days - trip.day })}</Txt>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: c.accentSoft, overflow: 'hidden' }}>
            <View style={{ height: 8, borderRadius: 4, width: `${Math.round((trip.day / trip.days) * 100)}%`, backgroundColor: trip.day >= trip.days ? c.ok : c.accent }} />
          </View>
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Feather name="map-pin" size={15} color={c.ink2} style={{ marginTop: 2 }} />
        <Txt variant="body" color="ink2" style={{ flex: 1, fontSize: 14 }} numberOfLines={2}>{job.location}</Txt>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Button size="md" kind="secondary" label={t('home.details')} onPress={onDetails} /></View>
        <View style={{ flex: 1 }}><Button size="md" icon="navigation" label={t('jobs.navigate')} onPress={() => openDirections(job.geofence_lat, job.geofence_lon, job.location)} /></View>
      </View>
    </>
  );
  // Inside the time-in card: a thin line above instead of a card of its own
  return inside
    ? <View style={{ gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.line }}>{body}</View>
    : <Card style={{ gap: 10 }}>{body}</Card>;
}
