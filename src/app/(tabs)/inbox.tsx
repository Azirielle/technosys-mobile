// Inbox tab: HR's replies, leave decisions and written warnings, and the office's announcements, newest first.
// A reply opens the conversation with HR on that ticket (app/ticket/[id].tsx); an announcement opens Updates. "Mark all as read" clears the dots.
import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { useT } from '../../lib/i18n';
import { getInbox, markRead, InboxItem } from '../../lib/inbox';
import { useFocusRefresh } from '../../lib/useFocusRefresh';
import { ago } from '../../components/jobs/jobWords';
import { Card, ListRow, Notice, SkeletonCard, StatusText, TAB_BAR_HEIGHT, Techy, Txt, tourTarget, useTokens, appAlert } from '../../ui';

export default function InboxScreen() {
  const t = useT();
  const { c, space } = useTokens();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { try { setItems(await getInbox()); setFailed(false); } catch { setFailed(true); } }, []);
  useFocusRefresh(load);

  const unread = (items ?? []).filter((i) => !i.read);
  const readAll = async () => { await markRead(unread.map((i) => i.id)); setItems((all) => all?.map((i) => ({ ...i, read: true })) ?? null); };

  const open = async (item: InboxItem) => {
    if (!item.read) await markRead([item.id]);
    if (item.kind === 'announcement') { router.push(`/updates?id=${item.id.replace(/^ann_/, '')}` as Href); return; } // that one, not the whole list
    if (item.kind === 'leave') { router.push('/leave' as Href); return; }
    if (item.kind === 'warning') { appAlert(item.title, `${item.text}\n\n${t('inbox.warningNote')}`); return; }
    router.push(`/ticket/${item.ticketId}` as Href);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={c.brand} colors={[c.brand]} />}
      >
      <Txt variant="title" accessibilityRole="header">{t('inbox.title')}</Txt>
      <Txt variant="body" color="ink2" style={{ marginBottom: 12 }}>{t('inbox.subtitle')}</Txt>
      {unread.length > 0 && (
        <Pressable onPress={readAll} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'flex-end', marginBottom: 8 }}>
          <Txt variant="label" style={{ color: c.brand }}>{t('inbox.markAll')}</Txt>
        </Pressable>
      )}
      {failed && <Notice tone="error" text={t('common.noSignal')} />}
      {!items && !failed && <View style={{ gap: 10 }}><SkeletonCard /><SkeletonCard /></View>}
      {items && items.length === 0 && (
        <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
          <Techy mood="rest" size={100} />
          <Txt variant="body" color="ink2" center>{t('inbox.none')}</Txt>
        </View>
      )}
      {items && items.length > 0 && (
        <Card padded={false}>
          {items.map((item, i) => (
            <View key={item.id} ref={i === 0 ? tourTarget('inbox-first') : undefined} collapsable={false}>{/* Techy's Inbox tip points at the first */}
            <ListRow
              icon={item.kind === 'announcement' ? 'volume-2' : item.kind === 'leave' ? 'sun' : item.kind === 'warning' ? 'alert-triangle' : 'message-square'}
              title={item.leave ? t('home.leaveItem', { type: t(`home.leaveTypes.${item.leave.type}`), date: item.leave.date }) : item.title}
              subtitle={`${item.text ? `${item.text.slice(0, 90)} · ` : ''}${ago(item.at, t)}`}
              right={item.kind === 'warning' ? <StatusText tone="error" label={t('inbox.warning')} /> : item.important ? <StatusText tone="error" label={t('updates.important')} /> : item.decision
                ? <StatusText tone={item.decision === 'Approved' ? 'ok' : item.decision === 'Refused' ? 'error' : 'info'} label={item.decision === 'Approved' ? t('inbox.approved') : item.decision === 'Refused' ? t('inbox.refused') : item.decision} />
                : !item.read ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.brand }} accessibilityLabel={t('inbox.new')} /> : undefined}
              onPress={() => open(item)}
              last={i === items.length - 1}
            />
            </View>
          ))}
        </Card>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}
