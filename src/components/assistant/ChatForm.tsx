// ChatForm: the one concern form, used in Techy's chat and on the DTR "Ask HR" and "Report a problem" screens (Andrew
// 27 Nov). DTR: what's wrong for that day, the right time in / out when it's about times, a note, a photo. Others: what
// happened, how urgent, a note, a photo. Sending turns an open Techy chat into the concern (lib/fileTicket: one ticket),
// and Techy confirms it in the chat. HR sees it all on the concern card in the admin, next to the real record.
import React, { useState } from 'react';
import { View } from 'react-native';
import { useT } from '../../lib/i18n';
import { askHrAboutDay, dayLabel } from '../../lib/dtr';
import { fileTicket, type NewTicket } from '../../lib/fileTicket';
import { manilaDay } from '../../lib/jobs';
import PhotoPicker from '../PhotoPicker';
import { Button, Card, ChoiceCard, Notice, Segmented, TextBox, TimeField, Txt, haptic, techy } from '../../ui';

const DTR = ['times', 'late', 'absent', 'overtime', 'other'] as const;
const DTR_ICON = { times: 'clock', late: 'alert-circle', absent: 'user-x', overtime: 'trending-up', other: 'help-circle' } as const;
const ASKS_TIMES = ['times', 'late', 'absent']; // the record can be fixed from these times
const OTHER = ['accident', 'vehicle', 'site', 'other'] as const;
const OTHER_ICON = { accident: 'alert-octagon', vehicle: 'truck', site: 'map-pin', other: 'edit-3' } as const;
// Saved in English: the office reads it in the admin
const OTHER_TITLE = { accident: 'Accident', vehicle: 'Vehicle problem', site: 'Problem at the site', other: 'Other concern' } as const;
const LEVELS: NewTicket['priority'][] = ['low', 'medium', 'high', 'urgent'];

type Props = { kind: 'dtr' | 'other'; date: string | null; onSent?: (ref: string) => void };

/** A DTR form needs a day that isn't in the future. */
export const formUsable = ({ kind, date }: Pick<Props, 'kind' | 'date'>) => kind === 'other' || (!!date && date <= manilaDay(new Date()));

export default function ChatForm({ kind, date, onSent }: Props) {
  const t = useT();
  const [pick, setPick] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [timeIn, setTimeIn] = useState('');
  const [timeOut, setTimeOut] = useState('');
  const [priority, setPriority] = useState<NewTicket['priority']>('medium');
  const [photo, setPhoto] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const dtr = kind === 'dtr';
  const keys: readonly string[] = dtr ? DTR : OTHER;
  const needsNote = dtr ? pick === 'other' && note.trim().length < 5 : note.trim().length < 5;
  const badTimes = !!timeIn && !!timeOut && timeOut <= timeIn;

  if (sent) return <Notice tone="ok" text={t(dtr ? 'chatForm.sentDtr' : 'chatForm.sentOther', { ref: sent })} />;

  const send = async () => {
    if (!pick || needsNote || badTimes) return;
    setSending(true); setFailed(false);
    const what = OTHER_TITLE[pick as keyof typeof OTHER_TITLE];
    const ref = dtr && date
      ? await askHrAboutDay(date, dayLabel(date), t(`dtrAsk.${pick}`), note, ASKS_TIMES.includes(pick) ? { timeIn, timeOut, photo } : { photo })
      : await fileTicket({ category: 'Others', title: what, description: [`What happened: ${what}`, `Details: ${note.trim()}`].join('\n'), priority },
        (r) => `✅ Sent to the office (ticket ${r}). ${what}: "${note.trim()}".\nPlease wait while the office reviews it. They'll reply right here. If it's an emergency, also call the office 📞`, photo);
    setSending(false);
    if (!ref) { setFailed(true); haptic.error(); return; }
    setSent(ref); techy.react('cheer'); haptic.success();
    onSent?.(ref);
  };

  return (
    <Card style={{ gap: 8 }}>
      <Txt variant="label">{dtr && date ? t('chatForm.dtrTitle', { date: dayLabel(date) }) : t('chatForm.otherTitle')}</Txt>
      <Txt variant="caption" color="ink2">{t(dtr ? 'dtrAsk.subtitle' : 'issue.subtitle')}</Txt>
      {keys.map((k) => (
        <ChoiceCard key={k} icon={dtr ? DTR_ICON[k as keyof typeof DTR_ICON] : OTHER_ICON[k as keyof typeof OTHER_ICON]}
          title={t(dtr ? `dtrAsk.${k}` : `issue.${k}`)} selected={pick === k} onPress={() => setPick(k)} />
      ))}
      {dtr && pick && ASKS_TIMES.includes(pick) && (
        <View style={{ gap: 6, marginTop: 4 }}>
          <Txt variant="caption" color="ink2">{t('chatForm.timesHint')}</Txt>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TimeField label={t('chatForm.timeIn')} value={timeIn} onChange={setTimeIn} placeholder={t('chatForm.pickTime')} />
            <TimeField label={t('chatForm.timeOut')} value={timeOut} onChange={setTimeOut} placeholder={t('chatForm.pickTime')} />
          </View>
          {badTimes && <Notice tone="error" text={t('chatForm.badTimes')} />}
        </View>
      )}
      {!dtr && (
        <View style={{ gap: 6, marginTop: 4 }}>
          <Txt variant="label">{t('issue.priority')}</Txt>
          <Segmented label={t('issue.priority')} value={priority} onChange={setPriority} options={LEVELS.map((l) => ({ value: l, label: t(`issue.level.${l}`) }))} />
        </View>
      )}
      <View style={{ marginTop: 4 }}>
        <TextBox label={dtr ? (pick === 'other' ? t('dtrAsk.noteRequired') : t('dtrAsk.note')) : t('issue.what')} value={note} onChangeText={setNote}
          placeholder={t(dtr ? 'dtrAsk.notePlaceholder' : 'issue.placeholder')} />
      </View>
      <PhotoPicker uri={photo} onChange={setPhoto} />
      {failed && <Notice tone="error" text={t('common.noSignal')} />}
      <Button label={t(dtr ? 'dtrAsk.send' : 'issue.send')} icon="send" onPress={send} loading={sending} disabled={!pick || needsNote || badTimes || sending} />
    </Card>
  );
}
