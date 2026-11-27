// Report a problem that isn't about DTR, leave or tools (prof, 20 Nov): an accident, a vehicle problem, a problem at
// the site, or something else. Pick what happened and how urgent it is, say what happened, send. It becomes an
// "Others" ticket for the office, linked to your Techy chat; the answer comes back there and in your Inbox.
import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useT } from '../lib/i18n';
import { fileTicket, type NewTicket } from '../lib/fileTicket';
import { Button, ChoiceCard, Notice, PushedScreen, SectionLabel, Segmented, SentScreen, TextBox, haptic, techy } from '../ui';

const KINDS = [
  { key: 'accident', icon: 'alert-octagon' },
  { key: 'vehicle', icon: 'truck' },
  { key: 'site', icon: 'map-pin' },
  { key: 'other', icon: 'edit-3' },
] as const;
type Kind = (typeof KINDS)[number]['key'];
const LEVELS: NewTicket['priority'][] = ['low', 'medium', 'high', 'urgent'];

export default function ReportIssueScreen() {
  const t = useT();
  const router = useRouter();
  const [kind, setKind] = useState<Kind | null>(null);
  const [priority, setPriority] = useState<NewTicket['priority']>('medium');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const ready = !!kind && note.trim().length >= 5;

  if (sent) {
    return <SentScreen title={t('issue.sentTitle')} text={t('issue.sentText', { ref: sent })} doneLabel={t('dtrAsk.done')}
      onDone={() => { router.back(); }} />;
  }

  const send = async () => {
    if (!ready || !kind) return;
    setSending(true); setFailed(false);
    // Saved in English: the office reads it in the admin
    const what = { accident: 'Accident', vehicle: 'Vehicle problem', site: 'Problem at the site', other: 'Other concern' }[kind];
    const ref = await fileTicket({ category: 'Others', title: what, description: note.trim(), priority },
      (r) => `I reported: ${what} (ticket ${r}). The office will reply here.`);
    setSending(false);
    if (ref) { setSent(ref); techy.react('cheer'); } else { setFailed(true); haptic.error(); }
  };

  return (
    <PushedScreen title={t('issue.title')} subtitle={t('issue.subtitle')} backLabel={t('common.back')}
      footer={<Button label={t('issue.send')} icon="send" onPress={send} loading={sending} disabled={!ready || sending} />}>
      <View style={{ gap: 10, marginTop: 8 }}>
        {KINDS.map((k) => <ChoiceCard key={k.key} icon={k.icon} title={t(`issue.${k.key}`)} selected={kind === k.key} onPress={() => setKind(k.key)} />)}
        <SectionLabel>{t('issue.priority')}</SectionLabel>
        <Segmented label={t('issue.priority')} value={priority} onChange={setPriority}
          options={LEVELS.map((l) => ({ value: l, label: t(`issue.level.${l}`) }))} />
        <View style={{ marginTop: 6 }}>
          <TextBox label={t('issue.what')} value={note} onChangeText={setNote} placeholder={t('issue.placeholder')} />
        </View>
        {failed && <Notice tone="error" text={t('common.noSignal')} />}
      </View>
    </PushedScreen>
  );
}
