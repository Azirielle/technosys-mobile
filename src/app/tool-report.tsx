// Report a problem with a tool you have (from My tools): pick what's wrong, add a note, send. It becomes an
// Equipment ticket for the office; the answer comes back in your Inbox.
import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useT } from '../lib/i18n';
import { getLoadedTool, reportToolProblem } from '../lib/tools';
import { Button, ChoiceCard, Notice, PushedScreen, SentScreen, TextBox, haptic, techy } from '../ui';

const PROBLEMS = [
  { key: 'broken', icon: 'alert-triangle' },
  { key: 'parts', icon: 'package' },
  { key: 'lost', icon: 'help-circle' },
  { key: 'other', icon: 'edit-3' },
] as const;
type Problem = (typeof PROBLEMS)[number]['key'];

export default function ToolReportScreen() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tool = id ? getLoadedTool(id) : null;
  const [problem, setProblem] = useState<Problem | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);
  const needsNote = problem === 'other' && note.trim().length < 5;

  if (sent) return <SentScreen title={t('toolReport.sentTitle')} text={t('toolReport.sentText')} doneLabel={t('dtrAsk.done')} onDone={() => router.back()} />;

  const send = async () => {
    if (!tool || !problem || needsNote) return;
    setSending(true); setFailed(false);
    const ok = await reportToolProblem(tool, t(`toolReport.${problem}`), note);
    setSending(false);
    if (ok) { setSent(true); techy.react('cheer'); } else { setFailed(true); haptic.error(); }
  };

  return (
    <PushedScreen title={t('toolReport.title')} subtitle={tool?.name} backLabel={t('common.back')}
      footer={tool ? <Button label={t('toolReport.send')} icon="send" onPress={send} loading={sending} disabled={!problem || needsNote || sending} /> : undefined}>
      {!tool ? <Notice tone="info" text={t('toolReport.missing')} /> : (
        <View style={{ gap: 10, marginTop: 8 }}>
          {PROBLEMS.map((p) => <ChoiceCard key={p.key} icon={p.icon} title={t(`toolReport.${p.key}`)} selected={problem === p.key} onPress={() => setProblem(p.key)} />)}
          <View style={{ marginTop: 6 }}>
            <TextBox label={problem === 'other' ? t('dtrAsk.noteRequired') : t('dtrAsk.note')} value={note} onChangeText={setNote} placeholder={t('toolReport.notePlaceholder')} />
          </View>
          {failed && <Notice tone="error" text={t('common.noSignal')} />}
        </View>
      )}
    </PushedScreen>
  );
}
