// Setup step: choose English or Filipino. Every screen after this uses the choice.
import React from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../context/ThemeContext';
import { useT } from '../../lib/i18n';
import { goAfter, markLanguageDone, stepNumber } from '../../lib/setup';
import SetupFrame from '../../components/setup/SetupFrame';
import SetupButton from '../../components/setup/SetupButton';
import { ChoiceCard, Txt, arrive, useReducedMotion } from '../../ui';

export default function LanguageStep() {
  const router = useRouter();
  const t = useT();
  const reduced = useReducedMotion();
  const { language, setLanguage } = useAppTheme();
  const { step, total } = stepNumber('language');

  const choices = [
    { code: 'en' as const, label: 'English', hint: t('setup.language.englishHint') },
    { code: 'tl' as const, label: 'Filipino', hint: t('setup.language.filipinoHint') },
  ];

  const next = async () => {
    await markLanguageDone();
    goAfter(router, 'language');
  };

  return (
    <SetupFrame
      step={step}
      total={total}
      title={t('setup.language.title')}
      subtitle={t('setup.language.subtitle')}
      footer={<SetupButton label={t('common.continue')} onPress={next} />}
    >
      {choices.map((ch, i) => (
        <Animated.View key={ch.code} entering={arrive(i + 1, reduced)}>
          <ChoiceCard big title={ch.label} subtitle={ch.hint} selected={language === ch.code} onPress={() => setLanguage(ch.code)} />
        </Animated.View>
      ))}
      <View style={{ marginTop: 4 }}><Txt variant="caption" color="ink2">{t('setup.language.later')}</Txt></View>
    </SetupFrame>
  );
}
