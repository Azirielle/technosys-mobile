// JobProgressCard (Work v2): while timed in on a job: "Arrived at the site" (jobs that report to the office
// first), "Job done", and "Ask for overtime" (hours + reason; the Coordinator approves it).
import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import RNModal from 'react-native-modal';
import { useT } from '../../lib/i18n';
import { locateMe } from '../../lib/timeIn';
import { askOvertime, markProgress } from '../../lib/work/workApi';
import { Button, Card, Segmented, TextBox, Txt, useTokens } from '../../ui';

type Props = { jobId: string; reportTo: 'site' | 'hq' };

export default function JobProgressCard({ jobId, reportTo }: Props) {
  const t = useT();
  const { c, radius } = useTokens();
  const [busy, setBusy] = useState<'arrived' | 'done' | 'ot' | null>(null);
  const [asking, setAsking] = useState(false);
  const [hours, setHours] = useState<'1' | '2' | '3'>('1');
  const [reason, setReason] = useState('');

  async function step(kind: 'arrived' | 'done') {
    setBusy(kind);
    const found = await locateMe().catch(() => null);
    const r = await markProgress(jobId, kind, found && typeof found !== 'string' ? found : null);
    setBusy(null);
    if (r.status === 'saved') Alert.alert(t(`work.${kind}Saved`));
    else if (r.status === 'already') Alert.alert(t('work.progressAlready'));
    else if (r.status === 'not_timed_in') Alert.alert(t('work.progressNotIn'));
    else Alert.alert(t('timeIn.outFailTitle'), t('common.noSignal'));
  }

  async function sendOvertime() {
    setBusy('ot');
    const r = await askOvertime(Number(hours), reason.trim());
    setBusy(null);
    if (r.status === 'saved') { setAsking(false); setReason(''); Alert.alert(t('work.otSentTitle'), t('work.otSentText')); }
    else Alert.alert(t('timeIn.outFailTitle'), t(r.status === 'already_asked' ? 'work.otAlready' : r.status === 'need_reason' ? 'work.otNeedReason' : 'common.noSignal'));
  }

  return (
    <Card style={{ gap: 10, marginTop: 10 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {reportTo === 'hq' && <View style={{ flex: 1 }}><Button size="md" kind="secondary" icon="map-pin" label={t('work.arrived')} onPress={() => step('arrived')} loading={busy === 'arrived'} /></View>}
        <View style={{ flex: 1 }}><Button size="md" kind="secondary" icon="check-circle" label={t('work.done')} onPress={() => step('done')} loading={busy === 'done'} /></View>
      </View>
      <Button size="md" kind="ghost" icon="clock" label={t('work.askOvertime')} onPress={() => setAsking(true)} />

      <RNModal isVisible={asking} useNativeDriver useNativeDriverForBackdrop hideModalContentWhileAnimating
        onBackdropPress={() => setAsking(false)} onBackButtonPress={() => setAsking(false)} style={{ margin: 0, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: c.card, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: 20, paddingBottom: 32, gap: 12 }}>
          <Txt variant="title" style={{ fontSize: 20 }}>{t('work.otTitle')}</Txt>
          <Txt variant="body" color="ink2">{t('work.otText')}</Txt>
          <Segmented label={t('work.otHours')} value={hours} onChange={setHours}
            options={[{ value: '1', label: '1 h' }, { value: '2', label: '2 h' }, { value: '3', label: '3 h' }]} />
          <TextBox label={t('work.reasonLabel')} value={reason} onChangeText={setReason} placeholder={t('work.otPlaceholder')} maxLength={200} />
          <Button label={t('work.otSend')} onPress={sendOvertime} loading={busy === 'ot'} disabled={reason.trim().length < 5} />
        </View>
      </RNModal>
    </Card>
  );
}
