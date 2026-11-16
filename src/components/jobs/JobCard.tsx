// JobCard: one job in a list. Time on the left, name and tags (work type, VIP, what changed) in the middle.
// Tap opens the job's own screen (address, team, map, Navigate): a slide, like every other screen, instead of
// growing the card in place (that made the whole list re-measure and felt slow).
import React from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import type { Job, JobChange } from '../../lib/jobs';
import { Card, Txt, useTokens } from '../../ui';
import JobTags from './JobTags';
import { timeOf } from './jobWords';

export default function JobCard({ job, change }: { job: Job; change?: JobChange }) {
  const { c } = useTokens();
  return (
    <Card onPress={() => router.push(`/job/${job.id}` as Href)} accessibilityLabel={`${job.client_name}, ${timeOf(job.start_time)}`}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <Txt variant="label" color="ink2" style={{ width: 62, marginTop: 2 }}>{timeOf(job.start_time)}</Txt>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt variant="heading" numberOfLines={2}>{job.client_name}</Txt>
          <JobTags job={job} change={change} done={job.status === 'completed'} />
        </View>
        <Feather name="chevron-right" size={20} color={c.ink3} style={{ marginTop: 2 }} />
      </View>
    </Card>
  );
}
