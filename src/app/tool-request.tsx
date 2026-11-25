// Request a tool from the Coordinator (from My tools): pick the tool, how many, the day you need it and why. It
// becomes a "Tool request" ticket; the Coordinator lends it (it then shows under My tools) or says why not.
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useT } from '../lib/i18n';
import { getToolCatalog, requestTool, type CatalogTool } from '../lib/tools';
import { openTechyChat } from '../components/assistant/TechyChatLayer';
import { Button, ChoiceCard, DateField, Notice, PushedScreen, SectionLabel, Segmented, SentScreen, SkeletonRow, TextBox, haptic, techy } from '../ui';

const COUNTS = ['1', '2', '3', '4'] as const;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

export default function ToolRequestScreen() {
  const t = useT();
  const router = useRouter();
  const [tools, setTools] = useState<CatalogTool[] | null>(null);
  const [tool, setTool] = useState<CatalogTool | null>(null);
  const [count, setCount] = useState<(typeof COUNTS)[number]>('1');
  const [day, setDay] = useState(ymd(new Date()));
  const [why, setWhy] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { getToolCatalog().then(setTools).catch(() => setFailed(true)); }, []);

  if (sent) {
    return <SentScreen title={t('toolRequest.sentTitle')} text={t('toolRequest.sentText', { ref: sent })} doneLabel={t('dtrAsk.done')}
      onDone={() => { router.back(); setTimeout(() => openTechyChat(), 60); }} />;
  }

  const send = async () => {
    if (!tool) return;
    setSending(true); setFailed(false);
    const ref = await requestTool(tool, Number(count), day, why);
    setSending(false);
    if (ref) { setSent(ref); techy.react('cheer'); } else { setFailed(true); haptic.error(); }
  };

  return (
    <PushedScreen title={t('toolRequest.title')} subtitle={t('toolRequest.subtitle')} backLabel={t('common.back')}
      footer={<Button label={t('toolRequest.send')} icon="send" onPress={send} loading={sending} disabled={!tool || sending} />}>
      <View style={{ gap: 10, marginTop: 8 }}>
        <SectionLabel>{t('toolRequest.which')}</SectionLabel>
        {!tools && !failed && <><SkeletonRow /><SkeletonRow /></>}
        {tools?.map((x) => (
          <ChoiceCard key={x.id} icon="tool" title={x.name} selected={tool?.id === x.id} onPress={() => setTool(x)}
            subtitle={x.available > 0 ? t('toolRequest.inStock', { n: x.available }) : t('toolRequest.noneLeft')} />
        ))}
        <SectionLabel>{t('toolRequest.howMany')}</SectionLabel>
        <Segmented label={t('toolRequest.howMany')} value={count} onChange={setCount} options={COUNTS.map((n) => ({ value: n, label: n }))} />
        <DateField label={t('toolRequest.when')} value={day} onChange={setDay} placeholder={t('leaveNew.pick')} minimumDate={new Date()} />
        <TextBox label={t('toolRequest.why')} value={why} onChangeText={setWhy} placeholder={t('toolRequest.whyPlaceholder')} />
        {failed && <Notice tone="error" text={t('common.noSignal')} />}
      </View>
    </PushedScreen>
  );
}
