// Top of Home: today's date over a plain "Today", and the bell (no background) with a count of new messages.
import React from 'react';
import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useT } from '../../lib/i18n';
import { Txt, haptic, useTokens } from '../../ui';

export default function HomeHeader({ unread, onBell }: { unread: number; onBell: () => void }) {
  const t = useT();
  const { c } = useTokens();
  const date = new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
      <View style={{ flex: 1 }}>
        <Txt variant="caption" color="ink2">{date}</Txt>
        <Txt variant="title" accessibilityRole="header">{t('home.today')}</Txt>
      </View>
      <Pressable onPress={() => { haptic.tap(); onBell(); }} hitSlop={10} accessibilityRole="button"
        accessibilityLabel={unread ? t('home.inboxNew', { n: unread }) : t('home.inbox')}
        style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
        <Feather name="bell" size={24} color={c.ink} />
        {unread > 0 && (
          <View style={{ position: 'absolute', top: 4, right: 2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: c.error, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.canvas }}>
            <Txt variant="caption" style={{ color: c.onBrand, fontSize: 10, lineHeight: 12 }}>{unread > 9 ? '9+' : unread}</Txt>
          </View>
        )}
      </Pressable>
    </View>
  );
}
