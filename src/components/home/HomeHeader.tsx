// Top of Home: today's date over a plain "Today". (Messages from the office are in the Inbox tab.)
import React from 'react';
import { View } from 'react-native';
import { useT } from '../../lib/i18n';
import { Txt } from '../../ui';

export default function HomeHeader() {
  const t = useT();
  const date = new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  return (
    <View style={{ marginBottom: 16 }}>
      <Txt variant="caption" color="ink2">{date}</Txt>
      <Txt variant="title" accessibilityRole="header">{t('home.today')}</Txt>
    </View>
  );
}
