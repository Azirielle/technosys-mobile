// Report a problem that isn't about DTR, leave or tools (prof, 20 Nov): an accident, a vehicle problem, a problem at
// the site, or something else. The same "Others" form as in Techy's chat (components/assistant/ChatForm): what
// happened, how urgent, a note, a photo. It becomes an "Others" concern for the office; the answer comes to your Inbox.
import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useT } from '../lib/i18n';
import ChatForm from '../components/assistant/ChatForm';
import { PushedScreen, SentScreen } from '../ui';

export default function ReportIssueScreen() {
  const t = useT();
  const router = useRouter();
  const [sent, setSent] = useState<string | null>(null);

  if (sent) return <SentScreen title={t('issue.sentTitle')} text={t('issue.sentText', { ref: sent })} doneLabel={t('dtrAsk.done')} onDone={() => router.back()} />;
  return (
    <PushedScreen title={t('issue.title')} subtitle={t('issue.subtitle')} backLabel={t('common.back')}>
      <ChatForm kind="other" date={null} onSent={setSent} />
    </PushedScreen>
  );
}
