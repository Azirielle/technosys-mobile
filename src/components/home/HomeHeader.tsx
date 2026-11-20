// Top of Home: "Today, Sat, Nov 22" so the day is never in doubt. (Messages from the office are in the Inbox tab.)
import React from 'react';
import { View } from 'react-native';
import { useT } from '../../lib/i18n';
import { Txt } from '../../ui';

export default function HomeHeader() {
  const t = useT();
  const date = new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
  return (
    <View style={{ marginBottom: 16 }}>
      <Txt variant="title" accessibilityRole="header">{t('home.todayDate', { date })}</Txt>
    </View>
  );
}
