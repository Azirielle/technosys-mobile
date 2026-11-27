// Request tools from the Coordinator (from My tools): tick one or more tools, each with how many ( – n + ), the day
// you need them, how they get to you (pick up at the office / driver delivers) and why (C5). One "Tool request"
// ticket per tool, so the Coordinator lends each as usual; until then they show under My tools as waiting.
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useT } from '../lib/i18n';
import { getToolCatalog, requestTools, type CatalogTool } from '../lib/tools';
import { Button, ChoiceCard, DateField, Notice, PushedScreen, SectionLabel, Segmented, SentScreen, SkeletonRow, TextBox, Txt, haptic, techy, useTokens } from '../ui';

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** – n + with the limits applied (1 to what's in the warehouse). */
function Stepper({ value, max, onChange, label }: { value: number; max: number; onChange: (n: number) => void; label: string }) {
  const { c } = useTokens();
  const step = (by: number) => { const n = Math.min(max, Math.max(1, value + by)); if (n !== value) { haptic.tap(); onChange(n); } };
  const btn = (icon: 'minus' | 'plus', by: number, disabled: boolean) => (
    <Pressable onPress={() => step(by)} disabled={disabled} accessibilityRole="button" accessibilityLabel={`${label} ${icon === 'plus' ? '+1' : '-1'}`} hitSlop={6}
      style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.line, opacity: disabled ? 0.4 : 1 }}>
      <Feather name={icon} size={18} color={c.ink} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, alignSelf: 'flex-end' }} accessibilityLabel={label}>
      {btn('minus', -1, value <= 1)}
      <Txt variant="heading" style={{ minWidth: 24, textAlign: 'center' }} accessibilityLiveRegion="polite">{value}</Txt>
      {btn('plus', 1, value >= max)}
    </View>
  );
}

export default function ToolRequestScreen() {
  const t = useT();
  const router = useRouter();
  const [tools, setTools] = useState<CatalogTool[] | null>(null);
  const [picks, setPicks] = useState<Record<string, number>>({}); // tool id → how many
  const [day, setDay] = useState(ymd(new Date()));
  const [delivery, setDelivery] = useState<'pickup' | 'driver'>('pickup');
  const [why, setWhy] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string[] | null>(null);
  const [sentSoFar, setSentSoFar] = useState<string[]>([]); // sent before the signal dropped; the rest stay ticked
  const [failed, setFailed] = useState(false);
  useEffect(() => { getToolCatalog().then(setTools).catch(() => setFailed(true)); }, []);

  if (sent) {
    return <SentScreen title={t('toolRequest.sentTitle')} text={t('toolRequest.sentText', { ref: sent.join(', ') })} doneLabel={t('dtrAsk.done')}
      onDone={() => { router.back(); }} />;
  }

  const chosen = (tools ?? []).filter((x) => picks[x.id]);
  const toggle = (x: CatalogTool) => setPicks((p) => {
    const next = { ...p };
    if (next[x.id]) delete next[x.id]; else next[x.id] = 1;
    return next;
  });

  const send = async () => {
    if (!chosen.length) return;
    setSending(true); setFailed(false);
    const refs = (await requestTools(chosen.map((x) => ({ tool: x, howMany: picks[x.id] })), day, why, delivery)) ?? [];
    setSending(false);
    if (refs.length === chosen.length) { setSent([...sentSoFar, ...refs]); techy.react('cheer'); return; }
    // Some went (in order), some didn't: untick the sent ones so Send asks only for the rest
    if (refs.length) {
      setSentSoFar((s) => [...s, ...refs]);
      setPicks((p) => { const next = { ...p }; chosen.slice(0, refs.length).forEach((x) => delete next[x.id]); return next; });
    }
    setFailed(true); haptic.error();
  };

  return (
    <PushedScreen title={t('toolRequest.title')} subtitle={t('toolRequest.subtitle')} backLabel={t('common.back')}
      footer={<Button label={chosen.length > 1 ? t('toolRequest.sendMany', { n: chosen.length }) : t('toolRequest.send')} icon="send" onPress={send} loading={sending} disabled={!chosen.length || sending} />}>
      <View style={{ gap: 10, marginTop: 8 }}>
        <SectionLabel>{t('toolRequest.which')}</SectionLabel>
        {!tools && !failed && <><SkeletonRow /><SkeletonRow /></>}
        {tools?.map((x) => (
          <View key={x.id} style={{ gap: 8 }}>
            <ChoiceCard icon="tool" title={x.name} selected={!!picks[x.id]} onPress={() => x.available > 0 && toggle(x)}
              subtitle={x.available > 0 ? t('toolRequest.inStock', { n: x.available }) : t('toolRequest.noneLeft')} />
            {!!picks[x.id] && (
              <Stepper value={picks[x.id]} max={x.available} label={t('toolRequest.howManyOf', { tool: x.name })}
                onChange={(n) => setPicks((p) => ({ ...p, [x.id]: n }))} />
            )}
          </View>
        ))}
        <DateField label={t('toolRequest.when')} value={day} onChange={setDay} placeholder={t('leaveNew.pick')} minimumDate={new Date()} />
        <SectionLabel>{t('toolRequest.delivery')}</SectionLabel>
        <Segmented label={t('toolRequest.delivery')} value={delivery} onChange={setDelivery}
          options={[{ value: 'pickup', label: t('toolRequest.pickup') }, { value: 'driver', label: t('toolRequest.driver') }]} />
        <TextBox label={t('toolRequest.why')} value={why} onChangeText={setWhy} placeholder={t('toolRequest.whyPlaceholder')} />
        {failed && <Notice tone="error" text={sentSoFar.length ? t('toolRequest.partSent', { refs: sentSoFar.join(', ') }) : t('common.noSignal')} />}
      </View>
    </PushedScreen>
  );
}
