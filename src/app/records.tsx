// My records (from Profile): everything you filed with its ticket number and where it stands. Tap a ticket to see the
// conversation with the office; tap a leave to see your leaves.
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useT } from '../lib/i18n';
import { getMyRecords, type MyRecord } from '../lib/records';
import { useFocusRefresh } from '../lib/useFocusRefresh';
import { Card, ListRow, Notice, PushedScreen, SkeletonRow, StatusText, Txt, type Tone } from '../ui';

const ICON = { dtr: 'clipboard', tool: 'tool', other: 'alert-circle', leave: 'sun' } as const;
const TONE: Record<string, Tone> = { open: 'pending', in_progress: 'info', resolved: 'ok', closed: 'info', pending: 'pending', approved: 'ok', rejected: 'error' };

export default function RecordsScreen() {
  const t = useT();
  const router = useRouter();
  const [records, setRecords] = useState<MyRecord[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { try { setRecords(await getMyRecords()); setFailed(false); } catch { setFailed(true); } }, []);
  useFocusRefresh(load);

  const title = (r: MyRecord) => (r.kind === 'leave' ? t('records.leave', { type: t(`records.leaveType.${r.title}`) }) : r.title);
  const sub = (r: MyRecord) => [r.ref, new Date(r.at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })].filter(Boolean).join(' · ');

  return (
    <PushedScreen title={t('records.title')} subtitle={t('records.subtitle')} backLabel={t('common.back')}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} refreshing={refreshing}>
      {failed && <Notice tone="error" text={t('common.noSignal')} />}
      {!records && !failed && <Card padded={false}><SkeletonRow /><SkeletonRow /></Card>}
      {records && records.length === 0 && <Txt variant="body" color="ink2" center style={{ marginTop: 24 }}>{t('records.none')}</Txt>}
      {records && records.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <Card padded={false}>
            {records.map((r, i) => (
              <ListRow key={r.id} icon={ICON[r.kind]} title={title(r)} subtitle={sub(r)} last={i === records.length - 1}
                right={<StatusText tone={TONE[r.status] ?? 'info'} label={t(`records.status.${r.status}`)} />}
                onPress={() => router.push((r.ticketId ? `/ticket/${r.ticketId}` : '/leave') as Href)} />
            ))}
          </Card>
        </View>
      )}
    </PushedScreen>
  );
}
