// Updates from the office (from Home): company announcements, newest first. Each shows who posted it and when;
// long ones open fully with "Read more". "Important" in words when the office marked it urgent or required.
// From the Inbox (?id=…) it shows just that announcement, fully open.
import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useT } from '../lib/i18n';
import { getUpdates, Update } from '../lib/updates';
import { markRead } from '../lib/inbox';
import { useFocusRefresh } from '../lib/useFocusRefresh';
import { ago } from '../components/jobs/jobWords';
import { Card, Notice, PushedScreen, SkeletonCard, StatusText, Techy, Txt, useTokens } from '../ui';

export default function UpdatesScreen() {
  const t = useT();
  const { c } = useTokens();
  const [updates, setUpdates] = useState<Update[] | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const load = useCallback(async () => {
    try {
      const u = await getUpdates();
      setUpdates(u); setFailed(false);
      markRead(u.map((x) => `ann_${x.id}`)).catch(() => {}); // seen here: the bell on Home clears
    } catch { setFailed(true); }
  }, []);
  useFocusRefresh(load);

  return (
    <PushedScreen title={t('updates.title')} subtitle={t('updates.subtitle')} backLabel={t('common.back')}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} refreshing={refreshing}>
      <View style={{ gap: 10, marginTop: 8 }}>
        {failed && <Notice tone="error" text={t('common.noSignal')} />}
        {!updates && !failed && <><SkeletonCard /><SkeletonCard /></>}
        {updates && updates.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
            <Techy mood="rest" size={100} />
            <Txt variant="body" color="ink2" center>{t('updates.none')}</Txt>
          </View>
        )}
        {(id && updates?.some((u) => u.id === id) ? updates.filter((u) => u.id === id) : updates)?.map((u) => {
          const long = !id && u.content.length > 160;
          const isOpen = !!id || !!open[u.id];
          return (
            <Card key={u.id} style={{ gap: 6, ...(u.read ? { opacity: 0.75 } : { backgroundColor: c.infoBg, borderLeftWidth: 4, borderLeftColor: c.info }) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Txt variant="caption" color="ink2" style={{ flex: 1 }} numberOfLines={1}>{[u.author ?? t('updates.office'), ago(u.createdAt, t)].join(' · ')}</Txt>
                {u.priority !== 'normal' && <StatusText tone={u.priority === 'urgent' ? 'error' : 'pending'} label={t(u.priority === 'urgent' ? 'updates.urgent' : 'updates.important')} />}
                {!u.read && <StatusText tone="info" label={t('inbox.new')} />}
              </View>
              <Txt variant="heading">{u.title}</Txt>
              <Txt variant="body" color="ink2" style={{ fontSize: 15, lineHeight: 22 }} numberOfLines={isOpen ? undefined : 4}>{u.content}</Txt>
              {long && (
                <Pressable onPress={() => setOpen((o) => ({ ...o, [u.id]: !o[u.id] }))} hitSlop={8} accessibilityRole="button">
                  <Txt variant="label" style={{ color: c.brand }}>{isOpen ? t('updates.less') : t('updates.more')}</Txt>
                </Pressable>
              )}
            </Card>
          );
        })}
      </View>
    </PushedScreen>
  );
}
