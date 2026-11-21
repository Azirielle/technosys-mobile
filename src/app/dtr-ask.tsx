// "Ask HR about this day": pick what looks wrong, add a note, send. It becomes a DTR concern in the admin's
// Tickets, and HR's answer comes back in Techy's chat or your Inbox. Scope has no payroll, so this is about the DTR only.
import React, { useState } from 'react';
import { View } from 'react-native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useT } from '../lib/i18n';
import { askHrAboutDay, dayLabel } from '../lib/dtr';
import { openTechyChat } from '../components/assistant/TechyChatLayer';
import { Button, ChoiceCard, Notice, PushedScreen, SentScreen, TextBox, haptic, techy } from '../ui';

const REASONS = [
  { key: 'times', icon: 'clock' },
  { key: 'late', icon: 'alert-circle' },
  { key: 'absent', icon: 'user-x' },
  { key: 'overtime', icon: 'trending-up' },
  { key: 'other', icon: 'help-circle' },
] as const;
type Reason = (typeof REASONS)[number]['key'];

export default function DtrAskScreen() {
  const t = useT();
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date: string }>();
  const [reason, setReason] = useState<Reason | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);
  const label = date ? dayLabel(date) : '';
  const needsNote = reason === 'other' && note.trim().length < 5;

  if (sent) {
    return (
      <SentScreen
        title={t('dtrAsk.sentTitle')}
        text={t('dtrAsk.sentText')}
        doneLabel={t('dtrAsk.done')}
        onDone={() => {
          router.replace('/(tabs)/dtr' as Href);
          setTimeout(() => openTechyChat(), 60);
        }}
      />
    );
  }

  const send = async () => {
    if (!date || !reason || needsNote) return;
    setSending(true); setFailed(false);
    const ok = await askHrAboutDay(date, label, t(`dtrAsk.${reason}`), note);
    setSending(false);
    if (ok) { setSent(true); techy.react('cheer'); } else { setFailed(true); haptic.error(); }
  };

  return (
    <PushedScreen title={t('dtrAsk.title', { date: label })} subtitle={t('dtrAsk.subtitle')} backLabel={t('common.back')}
      footer={<Button label={t('dtrAsk.send')} icon="send" onPress={send} loading={sending} disabled={!reason || needsNote || sending} />}>
      <View style={{ gap: 10, marginTop: 8 }}>
        {REASONS.map((r) => (
          <ChoiceCard key={r.key} icon={r.icon} title={t(`dtrAsk.${r.key}`)} selected={reason === r.key} onPress={() => setReason(r.key)} />
        ))}
        <View style={{ marginTop: 6 }}>
          <TextBox label={reason === 'other' ? t('dtrAsk.noteRequired') : t('dtrAsk.note')} value={note} onChangeText={setNote} placeholder={t('dtrAsk.notePlaceholder')} />
        </View>
        {failed && <Notice tone="error" text={t('common.noSignal')} />}
      </View>
    </PushedScreen>
  );
}
