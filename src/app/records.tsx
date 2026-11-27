// My records (from Profile): your whole activity in the app, newest first and grouped by day. Each row says what it
// is (Time in, Time out, Ticket, Leave, Tool…) with its own icon, and the switch on top shows one kind: Work (time in
// and out, jobs), Filed (tickets, leave, overtime, new phone) or Tools. Tap a row to open it where it lives.
import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useT } from '../lib/i18n';
import { GROUP, getMyRecords, type MyRecord, type RecordGroup, type RecordKind } from '../lib/records';
import { useFocusRefresh } from '../lib/useFocusRefresh';
import { Card, ListRow, Notice, PushedScreen, SectionLabel, Segmented, SkeletonRow, StatusText, Txt, type Tone } from '../ui';

const ICON: Record<RecordKind, React.ComponentProps<typeof ListRow>['icon']> = {
  time_in: 'log-in', time_out: 'log-out', arrived: 'map-pin', finished: 'check-circle',
  dtr: 'clipboard', tool: 'tool', other: 'alert-circle', leave: 'sun', overtime: 'clock', phone: 'smartphone',
  borrowed: 'package', returned: 'corner-down-left',
};
const TONE: Record<string, Tone> = {
  open: 'pending', in_progress: 'info', resolved: 'ok', closed: 'info', pending: 'pending', approved: 'ok', rejected: 'error',
  late: 'pending', needs_review: 'pending', damaged: 'error', lost: 'error',
};
type Show = 'all' | RecordGroup;

export default function RecordsScreen() {
  const t = useT();
  const router = useRouter();
  const [records, setRecords] = useState<MyRecord[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [show, setShow] = useState<Show>('all');
  const load = useCallback(async () => { try { setRecords(await getMyRecords()); setFailed(false); } catch { setFailed(true); } }, []);
  useFocusRefresh(load);

  const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const title = (r: MyRecord) =>
    r.kind === 'leave' ? t('records.leave', { type: t(`records.leaveType.${r.title}`) })
    : r.kind === 'overtime' ? t('records.overtimeTitle')
    : r.kind === 'phone' ? t('records.phoneTitle')
    : r.title || t(`records.kind.${r.kind}`);
  // What it is first (the distinction), then the details
  const sub = (r: MyRecord) => [
    t(`records.kind.${r.kind}`),
    r.ref,
    r.kind === 'time_out' && r.minutes != null ? t('records.hours', { h: r.minutes }) : null,
    r.kind === 'phone' && r.title ? r.title : null,
    time(r.at),
  ].filter(Boolean).join(' · ');
  const status = (r: MyRecord) => (r.status === 'late' ? t('records.lateBy', { m: r.minutes ?? 0 }) : t(`records.status.${r.status}`));

  // Grouped by day, newest first
  const days = useMemo(() => {
    const out: { label: string; items: MyRecord[] }[] = [];
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    for (const r of (records ?? []).filter((x) => show === 'all' || GROUP[x.kind] === show)) {
      const d = new Date(r.at);
      const label = d.toDateString() === today ? t('records.today') : d.toDateString() === yesterday ? t('records.yesterday')
        : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      if (out[out.length - 1]?.label !== label) out.push({ label, items: [] });
      out[out.length - 1].items.push(r);
    }
    return out;
  }, [records, show, t]);

  return (
    <PushedScreen title={t('records.title')} subtitle={t('records.subtitle')} backLabel={t('common.back')}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} refreshing={refreshing}>
      <View style={{ marginTop: 8 }}>
        <Segmented label={t('records.show')} value={show} onChange={setShow}
          options={(['all', 'work', 'filed', 'tools'] as const).map((v) => ({ value: v, label: t(`records.group.${v}`) }))} />
      </View>
      {failed && <Notice tone="error" text={t('common.noSignal')} />}
      {!records && !failed && <Card padded={false} style={{ marginTop: 16 }}><SkeletonRow /><SkeletonRow /></Card>}
      {records && days.length === 0 && <Txt variant="body" color="ink2" center style={{ marginTop: 24 }}>{t('records.none')}</Txt>}
      {days.map((d) => (
        <View key={d.label}>
          <SectionLabel>{d.label}</SectionLabel>
          <Card padded={false}>
            {d.items.map((r, i) => (
              <ListRow key={r.id} icon={ICON[r.kind]} title={title(r)} subtitle={sub(r)} last={i === d.items.length - 1}
                right={r.status ? <StatusText tone={TONE[r.status] ?? 'info'} label={status(r)} /> : undefined}
                onPress={r.href ? () => router.push(r.href as Href) : undefined} />
            ))}
          </Card>
        </View>
      ))}
    </PushedScreen>
  );
}
