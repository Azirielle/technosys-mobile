// The signed-in app: four tabs (Home · Jobs · DTR · Profile) with the glass tab bar and Techy docked on top of
// every tab. Switching tabs is instant, like the phone's own apps (no fade): the tab bar's pill is the motion.
// All four tabs load at start so the first visit isn't slow.
import React from 'react';
import { View } from 'react-native';
import { Tabs, router, type Href } from 'expo-router';
import { useT } from '../../lib/i18n';
import { sendHomeAction } from '../../lib/homeActions';
import { TabBar, TechyDock } from '../../ui';

const ICONS = { index: 'home', jobs: 'briefcase', dtr: 'clipboard', profile: 'user' } as const;

export default function TabsLayout() {
  const t = useT();

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{ headerShown: false, animation: 'none', lazy: false }}
        backBehavior="initialRoute"
        tabBar={(props) => <TabBar {...props} icons={ICONS} />}
      >
        <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
        <Tabs.Screen name="jobs" options={{ title: t('tabs.jobs') }} />
        <Tabs.Screen name="dtr" options={{ title: t('tabs.dtr') }} />
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
