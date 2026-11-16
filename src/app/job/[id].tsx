// Job details (from Home "Details" or a job on the Jobs tab): client, day and time, tags, address, the office's
// instructions, the team (call anyone), a street map of the site and its time-in circle, and Navigate.
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useT } from '../../lib/i18n';
import { getJob, kmBetween, whereAmI, JobDetails } from '../../lib/jobDetails';
import { getJobCrew, CrewMember } from '../../lib/crew';
import { openDirections } from '../../lib/directions';
import { supabase } from '../../lib/supabase';
import MapView, { Circle, Marker } from '../../components/MapWrapper';
import JobTags from '../../components/jobs/JobTags';
import { dateOf, timeRange } from '../../components/jobs/jobWords';
import { Button, Card, ListRow, Notice, PushedScreen, SectionLabel, SkeletonCard, SkeletonRow, Txt, useTokens } from '../../ui';

export default function JobDetailsScreen() {
  const t = useT();
  const { c, radius } = useTokens();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<JobDetails | null>(null);
  const [crew, setCrew] = useState<CrewMember[] | null>(null);
  const [me, setMe] = useState<{ lat: number; lon: number } | null>(null);
  const [myId, setMyId] = useState<string>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [{ data: { user } }, j] = await Promise.all([supabase.auth.getUser(), getJob(id)]);
        if (!j) { setFailed(true); return; }
        setMyId(user?.id); setJob(j);
        getJobCrew(j, user?.id).then(setCrew).catch(() => setCrew([]));
        whereAmI().then(setMe);
      } catch { setFailed(true); }
    })();
  }, [id]);

  const site = job?.geofence_lat != null && job?.geofence_lon != null ? { lat: job.geofence_lat, lon: job.geofence_lon } : null;
  const km = site && me ? kmBetween(me, site) : null;
  const call = (phone: string) => Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, '')}`);

  return (
    <PushedScreen title={job?.client_name ?? t('job.title')} subtitle={job ? `${dateOf(job.start_time)} · ${timeRange(job)}` : undefined} backLabel={t('common.back')}
      footer={job ? <Button icon="navigation" label={t('jobs.navigate')} onPress={() => openDirections(job.geofence_lat, job.geofence_lon, job.location)} /> : undefined}>
      {failed && <Notice tone="error" text={t('job.loadFailed')} />}
      {!job && !failed && <View style={{ gap: 10, marginTop: 8 }}><SkeletonCard height={90} /><SkeletonCard height={220} /></View>}
      {job && (
        <>
          <View style={{ marginTop: 4 }}><JobTags job={job} /></View>
          <Card style={{ marginTop: 14, gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Feather name="map-pin" size={16} color={c.ink2} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Txt variant="body">{job.location}</Txt>
                {km != null && <Txt variant="caption" color="ink2">{t('job.away', { km: km < 1 ? km.toFixed(1) : Math.round(km) })}</Txt>}
              </View>
            </View>
            {!!job.project_name && <Txt variant="caption" color="ink2">{t('job.project', { name: job.project_name })}</Txt>}
          </Card>
          {!!job.reporting_instruction && <View style={{ marginTop: 10 }}><Notice tone="info" text={job.reporting_instruction} /></View>}

          {site && (
            <View style={{ height: 220, borderRadius: radius.card, overflow: 'hidden', marginTop: 14, backgroundColor: c.cardSoft }}>
              <MapView style={{ flex: 1 }} initialRegion={{ latitude: site.lat, longitude: site.lon, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
                showsUserLocation={!!me} toolbarEnabled={false}>
                <Marker coordinate={{ latitude: site.lat, longitude: site.lon }} title={job.client_name} />
                {!!job.geofence_radius && (
                  <Circle center={{ latitude: site.lat, longitude: site.lon }} radius={job.geofence_radius} strokeColor={c.brand} fillColor={c.accentSoft} strokeWidth={2} />
                )}
              </MapView>
            </View>
          )}
          {site && !!job.geofence_radius && <Txt variant="caption" color="ink2" style={{ marginTop: 6 }}>{t('job.circle', { m: job.geofence_radius })}</Txt>}

          <SectionLabel>{t('job.team')}</SectionLabel>
          {crew === null ? <Card padded={false}><SkeletonRow /><SkeletonRow /></Card> : crew.length === 0 ? <Txt variant="body" color="ink2">{t('jobs.solo')}</Txt> : (
            <Card padded={false}>
              {crew.map((m, i) => (
                <ListRow key={m.id + m.type} icon={m.type === 'lead' ? 'award' : 'user'} title={m.id === myId ? `${m.name} (${t('job.you')})` : m.name}
                  subtitle={m.role} last={i === crew.length - 1}
                  right={m.phone && m.id !== myId ? (
                    <Pressable onPress={() => call(m.phone!)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('job.call', { name: m.name })}
                      style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.tint, alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name="phone" size={17} color={c.brand} />
                    </Pressable>
                  ) : undefined} />
              ))}
            </Card>
          )}
        </>
      )}
    </PushedScreen>
  );
}
