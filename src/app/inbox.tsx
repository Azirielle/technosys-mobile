// Inbox (the bell on Home): HR's replies on your tickets and the office's announcements, newest first.
// A reply opens the Support chat on that ticket; an announcement opens Updates. "Mark all as read" clears the dots.
import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useT } from '../lib/i18n';
import { getInbox, markRead, InboxItem } from '../lib/inbox';
import { sendHomeAction } from '../lib/homeActions';
import { useFocusRefresh } from '../lib/useFocusRefresh';
import { ago } from '../components/jobs/jobWords';
import { Card, ListRow, Notice, PushedScreen, SkeletonCard, StatusText, Techy, Txt, useTokens } from '../ui';

export default function InboxScreen() {
  const t = useT();
  const { c } = useTokens();
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { try { setItems(await getInbox()); setFailed(false); } catch { setFailed(true); } }, []);
  useFocusRefresh(load);

  const unread = (items ?? []).filter((i) => !i.read);
  const readAll = async () => { await markRead(unread.map((i) => i.id)); setItems((all) => all?.map((i) => ({ ...i, read: true })) ?? null); };

  const open = async (item: InboxItem) => {
    if (!item.read) await markRead([item.id]);
    if (item.kind === 'announcement') { router.push('/updates' as Href); return; }
    if (item.kind === 'leave') { router.push('/leave' as Href); return; }
    // The Support chat lives on Home: go back there and open it on this ticket
    router.dismissTo('/(tabs)' as Href);
    setTimeout(() => sendHomeAction({ kind: 'support', ticketId: item.ticketId }), 450);
  };

  return (
    <PushedScreen title={t('inbox.title')} subtitle={t('inbox.subtitle')} backLabel={t('common.back')}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} refreshing={refreshing}>
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
            <ListRow
              key={item.id}
              icon={item.kind === 'announcement' ? 'volume-2' : item.kind === 'leave' ? 'sun' : 'message-square'}
              title={item.leave ? t('home.leaveItem', { type: t(`home.leaveTypes.${item.leave.type}`), date: item.leave.date }) : item.title}
              subtitle={`${item.text ? `${item.text.slice(0, 90)} · ` : ''}${ago(item.at, t)}`}
              right={item.decision
                ? <StatusText tone={item.decision === 'Approved' ? 'ok' : item.decision === 'Refused' ? 'error' : 'info'} label={item.decision === 'Approved' ? t('inbox.approved') : item.decision === 'Refused' ? t('inbox.refused') : item.decision} />
                : !item.read ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.brand }} accessibilityLabel={t('inbox.new')} /> : undefined}
              onPress={() => open(item)}
              last={i === items.length - 1}
            />
          ))}
        </Card>
      )}
    </PushedScreen>
  );
}
