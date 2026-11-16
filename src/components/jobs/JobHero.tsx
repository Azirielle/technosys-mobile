// The top of the Jobs tab: the job you're on now or the next one, big, with the time, address, crew and
// Navigate, so "where do I go next?" is answered without tapping anything.
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useT } from '../../lib/i18n';
import { getJobCrew, CrewMember } from '../../lib/crew';
import { openDirections } from '../../lib/directions';
import type { Job, JobChange } from '../../lib/jobs';
import { Button, Card, SkeletonText, Txt, useTokens } from '../../ui';
import JobTags from './JobTags';
import { dateOf, timeRange } from './jobWords';

type Props = { job: Job; isToday: boolean; change?: JobChange; myId?: string };

export default function JobHero({ job, isToday, change, myId }: Props) {
  const t = useT();
  const { c } = useTokens();
  const [crew, setCrew] = useState<CrewMember[] | null>(null);
  useEffect(() => { setCrew(null); getJobCrew(job, myId).then(setCrew).catch(() => setCrew([])); }, [job.id, myId]); // eslint-disable-line react-hooks/exhaustive-deps
  const started = isToday && Date.parse(job.start_time) <= Date.now();
  const heading = started ? t('jobs.now') : isToday ? t('jobs.nextToday') : t('jobs.nextOn', { date: dateOf(job.start_time) });
  const others = (crew ?? []).filter((m) => m.id !== myId);

  const line = (icon: React.ComponentProps<typeof Feather>['name'], text: string) => (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Feather name={icon} size={15} color={c.ink2} style={{ marginTop: 3 }} />
      <Txt variant="body" color="ink2" style={{ flex: 1, fontSize: 15 }}>{text}</Txt>
    </View>
  );

  return (
    <Card style={{ gap: 10, borderLeftWidth: 4, borderLeftColor: c.accent }}>
      <Txt variant="label" style={{ color: c.brand }}>{heading}</Txt>
      <View style={{ gap: 2 }}>
        <Txt variant="title">{job.client_name}</Txt>
        <Txt variant="heading" color="ink2">{timeRange(job)}</Txt>
      </View>
      <JobTags job={job} change={change} />
      {line('map-pin', job.location)}
      {crew === null ? <SkeletonText lines={1} />
        : line('users', others.length ? `${t('jobs.crew', { n: others.length })} · ${others.map((m) => m.name).join(', ')}` : t('jobs.solo'))}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Button size="md" kind="secondary" label={t('home.details')} onPress={() => router.push(`/job/${job.id}` as Href)} /></View>
        <View style={{ flex: 1 }}><Button size="md" icon="navigation" label={t('jobs.navigate')} onPress={() => openDirections(job.geofence_lat, job.geofence_lon, job.location)} /></View>
      </View>
    </Card>
  );
}
