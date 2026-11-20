// Top of Home: "Today, Sat, Nov 22" so the day is never in doubt, and the bell for the office's announcements
// (Updates) with how many you haven't opened. Personal answers from HR stay in the Inbox tab.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useT } from '../../lib/i18n';
import { countUnreadUpdates, onInboxRead, watchInbox } from '../../lib/inbox';
import { useFocusRefresh } from '../../lib/useFocusRefresh';
import { Txt, useTokens } from '../../ui';

export default function HomeHeader() {
  const t = useT();
  const { c } = useTokens();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const load = useCallback(() => { countUnreadUpdates().then(setUnread).catch(() => {}); }, []);
  useFocusRefresh(load);
  useEffect(() => { const off = onInboxRead(load); const stop = watchInbox(load); return () => { off(); stop(); }; }, [load]);
  const date = new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
  return (
    <View style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Txt variant="title" accessibilityRole="header">{t('home.todayDate', { date })}</Txt>
      <Pressable onPress={() => router.push('/updates')} hitSlop={10} accessibilityRole="button"
        accessibilityLabel={unread ? t('home.bellUnread', { n: unread }) : t('home.bell')}
        style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.tint, opacity: pressed ? 0.7 : 1 })}>
        <Feather name="bell" size={21} color={c.brand} />
        {unread > 0 && (
          <View style={{ position: 'absolute', top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: c.error, alignItems: 'center', justifyContent: 'center' }}>
            <Txt variant="caption" style={{ color: c.onBrand, fontSize: 11, lineHeight: 14, fontWeight: '700' }}>{unread > 9 ? '9+' : String(unread)}</Txt>
          </View>
        )}
      </Pressable>
    </View>
  );
}
