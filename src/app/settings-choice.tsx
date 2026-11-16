// Appearance or Language, opened from Profile (/settings-choice?kind=appearance|language). Tap a choice and it
// applies at once (the check moves); Back returns to Profile.
import React from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useT } from '../lib/i18n';
import { useAppTheme } from '../context/ThemeContext';
import { BackHeader, ChoiceCard, Txt, haptic, useTokens } from '../ui';

export default function SettingsChoiceScreen() {
  const t = useT();
  const { c, space } = useTokens();
  const { kind } = useLocalSearchParams<{ kind: 'appearance' | 'language' }>();
  const { themeMode, setThemeMode, language, setLanguage } = useAppTheme();
  const isLanguage = kind === 'language';

  const options = isLanguage
    ? [{ value: 'en', title: 'English', sub: t('profile.languageEnSub'), icon: 'globe' as const }, { value: 'tl', title: 'Filipino', sub: t('profile.languageTlSub'), icon: 'globe' as const }]
    : [{ value: 'light', title: t('me.light'), sub: undefined, icon: 'sun' as const }, { value: 'dark', title: t('me.dark'), sub: undefined, icon: 'moon' as const }, { value: 'system', title: t('me.system'), sub: t('profile.systemSub'), icon: 'smartphone' as const }];
  const current = isLanguage ? language : themeMode;
  const choose = (v: string) => {
    if (v === current) return;
    haptic.tap();
    if (isLanguage) setLanguage(v as typeof language); else setThemeMode(v as typeof themeMode);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={['top', 'bottom']}>
      <BackHeader label={t('common.back')} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 40 }}>
        <Txt variant="title" accessibilityRole="header">{isLanguage ? t('me.language') : t('me.appearance')}</Txt>
        <View style={{ gap: 10, marginTop: 16 }} accessibilityRole="radiogroup">
          {options.map((o) => (
            <ChoiceCard key={o.value} icon={o.icon} title={o.title} subtitle={o.sub} selected={o.value === current} onPress={() => choose(o.value)} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
