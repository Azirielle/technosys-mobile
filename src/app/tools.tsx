// My tools (from Home): the tools you have with you now (how many, since when) and the ones you returned.
// Tap a tool you have to report a problem with it.
import React, { useCallback, useState } from 'react';
import { Image, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useT } from '../lib/i18n';
import { daysWithYou, getLoadedTools, getMyTools, MyTool, MyToolLists } from '../lib/tools';
import { useFocusRefresh } from '../lib/useFocusRefresh';
import { Card, IconChip, ListRow, Notice, PushedScreen, SectionLabel, SkeletonRow, StatusText, Techy, Txt, useTokens } from '../ui';


export default function ToolsScreen() {
  const t = useT();
  const router = useRouter();
  const { c } = useTokens();
  const [lists, setLists] = useState<MyToolLists | null>(getLoadedTools);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setLists(await getMyTools()); setFailed(false); } catch { setFailed(true); }
  }, []);
  useFocusRefresh(load);

  const sub = (x: MyTool) => [x.category, x.serial ? `SN ${x.serial}` : null].filter(Boolean).join(' · ') || undefined;
  const photo = (x: MyTool) => x.imageUrl
    ? <Image source={{ uri: x.imageUrl }} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.cardSoft }} />
    : <IconChip icon="tool" />;

  return (
    <PushedScreen title={t('tools.title')} subtitle={t('tools.subtitle')} backLabel={t('common.back')}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} refreshing={refreshing}>
      {failed && <Notice tone="error" text={t('common.noSignal')} />}
      {!lists && !failed && <Card padded={false}><SkeletonRow /><SkeletonRow /></Card>}
      {lists && (
        <>
          <SectionLabel>{t('tools.withYou', { n: lists.withYou.length })}</SectionLabel>
          {lists.withYou.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 24, gap: 6 }}>
              <Techy mood="ready" size={96} />
              <Txt variant="body" color="ink2" center>{t('tools.none')}</Txt>
            </View>
          ) : (
            <Card padded={false}>
              {lists.withYou.map((x, i) => (
                <ListRow key={x.id} icon="tool" leading={photo(x)} title={x.quantity > 1 ? `${x.name} × ${x.quantity}` : x.name} subtitle={sub(x)}
                  last={i === lists.withYou.length - 1} right={<StatusText tone="info" label={t('tools.days', { n: daysWithYou(x) })} />}
                  onPress={() => router.push(`/tool-report?id=${x.id}` as Href)} />
              ))}
            </Card>
          )}
          {lists.withYou.length > 0 && <Txt variant="caption" color="ink2" style={{ marginTop: 8 }}>{t('tools.tapHint')}</Txt>}

          {lists.returned.length > 0 && (
            <>
              <SectionLabel>{t('tools.returned')}</SectionLabel>
              <Card padded={false}>
                {lists.returned.map((x, i) => (
                  <ListRow key={x.id} icon="check" title={x.name} subtitle={x.returnedAt ? t('tools.returnedOn', { date: new Date(x.returnedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) }) : undefined}
                    right={x.status === 'returned' ? undefined : <StatusText tone="error" label={t(`tools.status_${x.status}`)} />} last={i === lists.returned.length - 1} />
                ))}
              </Card>
            </>
          )}
        </>
      )}
    </PushedScreen>
  );
}
