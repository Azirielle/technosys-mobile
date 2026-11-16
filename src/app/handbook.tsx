// Handbook and forms (opened from Me): company policies to read first, then the ones you've signed.
// Full titles (no cut-off "…"), plain category names, status in words. Back returns to Me.
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useFocusRefresh } from '../lib/useFocusRefresh';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useT } from '../lib/i18n';
import { HandbookItem, categoryOf, loadHandbook, signPolicy } from '../lib/handbook';
import PolicyReaderModal, { CompanyPolicy } from '../components/PolicyReaderModal';
import { BackHeader, Card, IconChip, Notice, SectionLabel, SkeletonRow, StatusText, Techy, Txt, useTokens } from '../ui';

type Lists = Awaited<ReturnType<typeof loadHandbook>>;

export default function HandbookScreen() {
  const t = useT();
  const { c, space } = useTokens();
  const [lists, setLists] = useState<Lists | null>(null);
  const [failed, setFailed] = useState(false);
  const [reading, setReading] = useState<HandbookItem | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try { setLists(await loadHandbook()); } catch { setFailed(true); }
  }, []);
  useFocusRefresh(load);

  const row = (item: HandbookItem, last: boolean) => {
    const cat = categoryOf(item.policy.category);
    const signed = item.signedAt ? new Date(item.signedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : null;
    return (
      <Pressable key={item.policy.id} onPress={() => setReading(item)} accessibilityRole="button" accessibilityLabel={item.policy.title}
        style={({ pressed }) => ({ flexDirection: 'row', gap: 12, paddingVertical: 13, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.line, opacity: pressed ? 0.7 : 1 })}>
        <IconChip icon={cat.icon} size="sm" />
        <View style={{ flex: 1, gap: 3 }}>
          <Txt variant="body" style={{ fontSize: 15, lineHeight: 20 }} numberOfLines={2}>{item.policy.title}</Txt>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {signed ? <StatusText tone="ok" label={t('handbook.signedOn', { date: signed })} />
              : item.mustRead ? <StatusText tone="info" label={t('handbook.toRead')} />
              : <StatusText tone="info" label={t('handbook.optional')} />}
            <Txt variant="caption" color="ink3">{cat.label} · {item.policy.version}</Txt>
          </View>
        </View>
        <Feather name="chevron-right" size={18} color={c.ink3} style={{ marginTop: 4 }} />
      </Pressable>
    );
  };
  const section = (label: string, items: HandbookItem[], i: number) => items.length > 0 && (
    <Animated.View key={label}>
      <SectionLabel>{label}</SectionLabel>
      <Card padded={false}>{items.map((it, j) => row(it, j === items.length - 1))}</Card>
    </Animated.View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={['top', 'bottom']}>
      <BackHeader label={t('common.back')} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 40 }}>
        <Txt variant="title" accessibilityRole="header">{t('handbook.title')}</Txt>
        <Txt variant="body" color="ink2" style={{ marginTop: 4 }}>{t('handbook.subtitle')}</Txt>

        {failed && <View style={{ marginTop: 16 }}><Notice tone="error" text={t('handbook.loadFailed')} /></View>}
        {!lists && !failed && <Card padded={false} style={{ marginTop: 18 }}><SkeletonRow /><SkeletonRow /><SkeletonRow /></Card>}
        {lists && lists.toRead.length === 0 && (
          <Animated.View>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 }}>
              <Techy mood="cheer" size={64} />
              <Txt variant="body" style={{ flex: 1 }}>{t('handbook.allDone')}</Txt>
            </Card>
          </Animated.View>
        )}
        {lists && (
          <>
            {section(t('handbook.sectionToRead', { n: lists.toRead.length }), lists.toRead, 1)}
            {section(t('handbook.sectionSigned'), lists.signed, 2)}
            {section(t('handbook.sectionOther'), lists.other, 3)}
          </>
        )}
      </ScrollView>

      <PolicyReaderModal
        visible={!!reading}
        policy={reading?.policy as CompanyPolicy | null}
        isAcknowledged={!!reading?.signedAt}
        acknowledgedAt={reading?.signedAt}
        onClose={() => { setReading(null); load(); }}
        onAcknowledge={signPolicy}
      />
    </SafeAreaView>
  );
}
