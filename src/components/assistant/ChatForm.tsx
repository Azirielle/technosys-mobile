// ChatForm: the one form Techy offers, filled in right inside the chat (Andrew 27 Nov). "DTR issue on Nov 23" → the
// DTR form for Nov 23 (what's wrong + a note); "Others" → what happened + a note. Sending turns this chat into that
// concern (lib/fileTicket: one ticket, not two), the chat shows "sent", and HR answers in the same conversation.
import React, { useState } from 'react';
import { View } from 'react-native';
import { useT } from '../../lib/i18n';
import { askHrAboutDay, dayLabel } from '../../lib/dtr';
import { fileTicket } from '../../lib/fileTicket';
import { manilaDay } from '../../lib/jobs';
import { Button, Card, ChoiceCard, Notice, TextBox, Txt, haptic, techy } from '../../ui';

const DTR = ['times', 'late', 'absent', 'overtime', 'other'] as const;
const DTR_ICON = { times: 'clock', late: 'alert-circle', absent: 'user-x', overtime: 'trending-up', other: 'help-circle' } as const;
const OTHER = ['accident', 'vehicle', 'site', 'other'] as const;
const OTHER_ICON = { accident: 'alert-octagon', vehicle: 'truck', site: 'map-pin', other: 'edit-3' } as const;
// Saved in English: the office reads it in the admin
const OTHER_TITLE = { accident: 'Accident', vehicle: 'Vehicle problem', site: 'Problem at the site', other: 'Other concern' } as const;

type Props = { kind: 'dtr' | 'other'; date: string | null };

/** null = the form can't be shown (a DTR form needs a day that isn't in the future). */
export const formUsable = ({ kind, date }: Props) => kind === 'other' || (!!date && date <= manilaDay(new Date()));

export default function ChatForm({ kind, date }: Props) {
  const t = useT();
  const [pick, setPick] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const dtr = kind === 'dtr';
  const keys: readonly string[] = dtr ? DTR : OTHER;
  const needsNote = dtr ? pick === 'other' && note.trim().length < 5 : note.trim().length < 5;

  if (sent) return <Notice tone="ok" text={t(dtr ? 'chatForm.sentDtr' : 'chatForm.sentOther', { ref: sent })} />;

  const send = async () => {
    if (!pick || needsNote) return;
    setSending(true); setFailed(false);
    const ref = dtr && date
      ? await askHrAboutDay(date, dayLabel(date), t(`dtrAsk.${pick}`), note)
      : await fileTicket({ category: 'Others', title: OTHER_TITLE[pick as keyof typeof OTHER_TITLE], description: note.trim(), priority: pick === 'accident' ? 'high' : 'medium' },
        (r) => `⚠️ ${OTHER_TITLE[pick as keyof typeof OTHER_TITLE]}: ${note.trim()} (ticket ${r})`);
    setSending(false);
    if (ref) { setSent(ref); techy.react('cheer'); haptic.success(); } else { setFailed(true); haptic.error(); }
  };

  return (
    <Card style={{ gap: 8 }}>
      <Txt variant="label">{dtr && date ? t('chatForm.dtrTitle', { date: dayLabel(date) }) : t('chatForm.otherTitle')}</Txt>
      <Txt variant="caption" color="ink2">{t(dtr ? 'dtrAsk.subtitle' : 'issue.subtitle')}</Txt>
      {keys.map((k) => (
        <ChoiceCard key={k} icon={dtr ? DTR_ICON[k as keyof typeof DTR_ICON] : OTHER_ICON[k as keyof typeof OTHER_ICON]}
          title={t(dtr ? `dtrAsk.${k}` : `issue.${k}`)} selected={pick === k} onPress={() => setPick(k)} />
      ))}
      <View style={{ marginTop: 4 }}>
        <TextBox label={dtr ? (pick === 'other' ? t('dtrAsk.noteRequired') : t('dtrAsk.note')) : t('issue.what')} value={note} onChangeText={setNote}
          placeholder={t(dtr ? 'dtrAsk.notePlaceholder' : 'issue.placeholder')} />
      </View>
      {failed && <Notice tone="error" text={t('common.noSignal')} />}
      <Button label={t(dtr ? 'dtrAsk.send' : 'issue.send')} icon="send" onPress={send} loading={sending} disabled={!pick || needsNote || sending} />
    </Card>
  );
}
