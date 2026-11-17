// The signed-in app: four tabs (Home · Jobs · Inbox · Profile; DTR opens from Home) with the glass tab bar and Techy docked on top of
// every tab. Switching tabs is instant, like the phone's own apps (no fade): the tab bar's pill is the motion.
// All four tabs load at start so the first visit isn't slow.
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Tabs, router, type Href } from 'expo-router';
import { useT } from '../../lib/i18n';
import { sendHomeAction } from '../../lib/homeActions';
import { countUnread, onInboxRead, watchInbox } from '../../lib/inbox';
import { TabBar, TechyDock } from '../../ui';

const ICONS = { index: 'home', jobs: 'briefcase', inbox: 'inbox', profile: 'user' } as const;

export default function TabsLayout() {
  const t = useT();
  // The count on the Inbox tab: on start, when HR answers, and on every tab change (opening the Inbox marks items read)
  const [unread, setUnread] = useState(0);
  const recount = useCallback(() => { countUnread().then(setUnread).catch(() => {}); }, []);
  useEffect(() => { recount(); const stopWatch = watchInbox(recount), stopRead = onInboxRead(recount); return () => { stopWatch(); stopRead(); }; }, [recount]);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{ headerShown: false, animation: 'none', lazy: false }}
        screenListeners={{ state: recount }}
        backBehavior="initialRoute"
        tabBar={(props) => <TabBar {...props} icons={ICONS} badges={{ inbox: unread }} />}
      >
        <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
        <Tabs.Screen name="jobs" options={{ title: t('tabs.jobs') }} />
        <Tabs.Screen name="inbox" options={{ title: t('home.inbox') }} />
        <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
      </Tabs>
      <TechyDock
        onAsk={() => {
          // Ask Techy still lives on Home (redesigned in its own phase)
          router.navigate('/(tabs)' as Href);
          setTimeout(() => sendHomeAction({ kind: 'support' }), 60);
        }}
      />
    </View>
  );
}
