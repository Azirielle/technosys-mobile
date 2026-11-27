// "Ask HR about this day" (from a DTR day): the same DTR concern form as in Techy's chat (components/assistant/ChatForm):
// what's wrong, the right times, a note, a photo. It becomes a DTR concern in the admin's Tickets with HR's concern card;
// HR's answer comes back in your Inbox. Scope has no payroll, so this is about the DTR only.
import React, { useState } from 'react';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useT } from '../lib/i18n';
import { dayLabel } from '../lib/dtr';
import ChatForm from '../components/assistant/ChatForm';
import { PushedScreen, SentScreen } from '../ui';

export default function DtrAskScreen() {
  const t = useT();
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date: string }>();
  const [sent, setSent] = useState<string | null>(null); // the ticket's number

  if (sent) {
    return <SentScreen title={t('dtrAsk.sentTitle')} text={t('dtrAsk.sentTicket', { ref: sent })} doneLabel={t('dtrAsk.done')}
      onDone={() => router.replace('/(tabs)/dtr' as Href)} />;
  }
  return (
    <PushedScreen title={t('dtrAsk.title', { date: date ? dayLabel(date) : '' })} subtitle={t('dtrAsk.subtitle')} backLabel={t('common.back')}>
      {date ? <ChatForm kind="dtr" date={date} onSent={setSent} /> : null}
    </PushedScreen>
  );
}
