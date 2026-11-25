// File a leave (from Leave): type, first and last day, reason, and a photo of the medical certificate for sick
// leave. Plain checks before sending; HR answers in Leave and the Inbox.
import React, { useState } from 'react';
import { Image, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useT } from '../lib/i18n';
import { fileLeave, leaveDays, LeaveType } from '../lib/leaves';
import { Button, ChoiceCard, DateField, Notice, PushedScreen, SectionLabel, SentScreen, TextBox, Txt, haptic, techy, useTokens, appAlert } from '../ui';

const TYPES: { key: LeaveType; icon: 'sun' | 'thermometer' | 'alert-circle' | 'clock' }[] = [
  { key: 'vacation', icon: 'sun' }, { key: 'sick', icon: 'thermometer' }, { key: 'emergency', icon: 'alert-circle' }, { key: 'unpaid', icon: 'clock' },
];
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

export default function LeaveNewScreen() {
  const t = useT();
  const router = useRouter();
  const { c, radius } = useTokens();
  const [type, setType] = useState<LeaveType | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (sent) return <SentScreen title={t('leaveNew.sentTitle')} text={t('leaveNew.sentText')} doneLabel={t('dtrAsk.done')} onDone={() => router.back()} />;

  const problem = !type ? t('leaveNew.needType') : !start || !end ? t('leaveNew.needDates') : end < start ? t('leaveNew.endBeforeStart')
    : reason.trim().length < 5 ? t('leaveNew.needReason') : type === 'sick' && !photo ? t('leaveNew.needCertificate') : null;

  const pickPhoto = (source: 'camera' | 'library') => async () => {
    // Gallery = Android's photo picker, which needs no permission (Google Play allows no broad photo access here)
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : { granted: true };
    if (!perm.granted) { appAlert(t('leaveNew.certificate'), t('me.photoPermission')); return; }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6 };
    const r = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!r.canceled && r.assets[0]?.uri) setPhoto(r.assets[0].uri);
  };
  const send = async () => {
    if (problem) { setError(problem); haptic.error(); return; }
    setSending(true); setError(null);
    const r = await fileLeave({ type: type!, start, end, reason, certificateUri: type === 'sick' ? photo : null });
    setSending(false);
    if (r.ok) { setSent(true); techy.react('cheer'); }
    else { setError(r.reason === 'upload' ? t('leaveNew.uploadFailed') : t('common.noSignal')); haptic.error(); }
  };

  return (
    <PushedScreen title={t('leave.fileNew')} backLabel={t('common.back')}
      footer={<Button label={t('leaveNew.send')} icon="send" onPress={send} loading={sending} disabled={sending} />}>
      <SectionLabel>{t('leaveNew.type')}</SectionLabel>
      <View style={{ gap: 10 }}>
        {TYPES.map((x) => <ChoiceCard key={x.key} icon={x.icon} title={t(`home.leaveTypes.${x.key}`)} subtitle={t(`leaveNew.typeSub_${x.key}`)} selected={type === x.key} onPress={() => setType(x.key)} />)}
      </View>

      <SectionLabel>{t('leaveNew.when')}</SectionLabel>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <DateField label={t('leaveNew.firstDay')} value={start} placeholder={t('leaveNew.pick')} minimumDate={today()}
          onChange={(v) => { setStart(v); if (!end || end < v) setEnd(v); }} />
        <DateField label={t('leaveNew.lastDay')} value={end} placeholder={t('leaveNew.pick')} onChange={setEnd}
          minimumDate={start ? new Date(`${start}T00:00:00`) : today()} />
      </View>
      {!!start && !!end && end >= start && <Txt variant="caption" color="ink2" style={{ marginTop: 6 }}>{t('leaveNew.days', { n: leaveDays(start, end) })}</Txt>}

      <View style={{ marginTop: 18 }}>
        <TextBox label={t('leaveNew.reason')} value={reason} onChangeText={setReason} placeholder={t('leaveNew.reasonPlaceholder')} />
      </View>

      {type === 'sick' && (
        <>
          <SectionLabel>{t('leaveNew.certificate')}</SectionLabel>
          {photo && <Image source={{ uri: photo }} style={{ width: '100%', height: 180, borderRadius: radius.card, backgroundColor: c.cardSoft, marginBottom: 10 }} resizeMode="cover" />}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Button size="md" kind="secondary" icon="camera" label={t('me.photoCamera')} onPress={pickPhoto('camera')} /></View>
            <View style={{ flex: 1 }}><Button size="md" kind="secondary" icon="image" label={t('me.photoLibrary')} onPress={pickPhoto('library')} /></View>
          </View>
        </>
      )}
      {!!error && <View style={{ marginTop: 14 }}><Notice tone="error" text={error} /></View>}
    </PushedScreen>
  );
}
