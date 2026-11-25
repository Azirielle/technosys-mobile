// Leave (from Home): "File a leave" on top, then your requests with their status in words (Waiting for HR,
// Approved, Not approved + HR's reason).
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useT } from '../lib/i18n';
import { getMyCredits, getMyLeaves, leaveDays, MyLeave, type Credits } from '../lib/leaves';
import { useFocusRefresh } from '../lib/useFocusRefresh';
import { Button, Card, IconChip, Notice, PushedScreen, SectionLabel, SkeletonRow, StatusText, Txt, type Tone, useTokens } from '../ui';

const STATUS: Record<string, { tone: Tone; key: string }> = {
  pending: { tone: 'pending', key: 'home.waitingHr' },
  approved: { tone: 'ok', key: 'leave.approved' },
  rejected: { tone: 'error', key: 'home.notApproved' },
};
const short = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' });

export default function LeaveScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTokens();
  const [leaves, setLeaves] = useState<MyLeave[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [credits, setCredits] = useState<Credits | null>(null);
  const load = useCallback(async () => {
    getMyCredits().then(setCredits).catch(() => {});
    try { setLeaves(await getMyLeaves()); setFailed(false); } catch { setFailed(true); }
  }, []);
  useFocusRefresh(load);

  return (
    <PushedScreen title={t('leave.title')} subtitle={t('leave.subtitle')} backLabel={t('common.back')}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} refreshing={refreshing}>
      <View style={{ marginTop: 8 }}>
        <Button icon="plus" label={t('leave.fileNew')} onPress={() => router.push('/leave-new' as Href)} />
      </View>
      {credits && (
        <Card style={{ marginTop: 12, gap: 2 }}>
          <Txt variant="label">{t('leave.credits')}</Txt>
          <Txt variant="body" color="ink2">{t('leave.creditsLeft', { sick: credits.sick_left, vacation: credits.vacation_left })}</Txt>
          {credits.without_credits > 0 && <Txt variant="caption" color="ink2">{t('leave.withoutCredits', { n: credits.without_credits })}</Txt>}
          <Txt variant="caption" color="ink2">{t('leave.creditsRule')}</Txt>
        </Card>
      )}
      <SectionLabel>{t('leave.yourRequests')}</SectionLabel>
      {failed && <Notice tone="error" text={t('common.noSignal')} />}
      {!leaves && !failed && <Card padded={false}><SkeletonRow /><SkeletonRow /></Card>}
      {leaves && leaves.length === 0 && <Txt variant="body" color="ink2">{t('leave.none')}</Txt>}
      {leaves && leaves.length > 0 && (
        <Card padded={false}>
          {leaves.map((l, i) => {
            const s = STATUS[l.status] ?? STATUS.pending!;
            const days = leaveDays(l.start_date, l.end_date);
            return (
              <View key={l.id} style={{ flexDirection: 'row', gap: 12, padding: 14, borderBottomWidth: i === leaves.length - 1 ? 0 : 1, borderBottomColor: c.line }}>
                <IconChip icon={l.leave_type === 'sick' ? 'thermometer' : 'sun'} size="sm" />
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Txt variant="label" style={{ flex: 1 }}>{t('home.leaveItem', { type: t(`home.leaveTypes.${l.leave_type}`), date: short(l.start_date) })}</Txt>
                    <StatusText tone={s.tone} label={t(s.key)} />
                  </View>
                  <Txt variant="caption" color="ink2">
                    {l.start_date === l.end_date ? t('leave.oneDay') : t('leave.range', { from: short(l.start_date), to: short(l.end_date), n: days })}
                    {l.attachment_url ? ` · ${t('leave.withCertificate')}` : ''}
                  </Txt>
                  {!!l.reason && <Txt variant="body" color="ink2" style={{ fontSize: 14 }} numberOfLines={2}>{l.reason}</Txt>}
                  {l.status === 'rejected' && !!l.rejection_reason && (
                    <Txt variant="body" style={{ fontSize: 14, color: c.error }}>{t('leave.whyDeclined', { reason: l.rejection_reason })}</Txt>
                  )}
                </View>
              </View>
            );
          })}
        </Card>
      )}
    </PushedScreen>
  );
}
