// Setup step: choose English or Filipino. Every screen after this uses the choice.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
import { useT } from '../../lib/i18n';
import { goAfter, markLanguageDone, stepNumber } from '../../lib/setup';
import SetupFrame from '../../components/setup/SetupFrame';
import SetupButton from '../../components/setup/SetupButton';

export default function LanguageStep() {
  const router = useRouter();
  const t = useT();
  const { colors, language, setLanguage } = useAppTheme();
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
      {choices.map(c => {
        const on = language === c.code;
        return (
          <TouchableOpacity
            key={c.code}
            onPress={() => setLanguage(c.code)}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={[styles.choice, { backgroundColor: colors.card, borderColor: on ? colors.brandBlue : colors.cardBorder }, on && styles.choiceOn]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.text }]}>{c.label}</Text>
              <Text style={[styles.hint, { color: colors.textMuted }]}>{c.hint}</Text>
            </View>
            <View style={[styles.radio, { borderColor: on ? colors.brandBlue : colors.cardBorder, backgroundColor: on ? colors.brandBlue : 'transparent' }]}>
              {on && <Feather name="check" size={16} color="#FFFFFF" />}
            </View>
          </TouchableOpacity>
        );
      })}
      <Text style={[styles.hint, { color: colors.textMuted, marginTop: 4 }]}>{t('setup.language.later')}</Text>
    </SetupFrame>
  );
}

const styles = StyleSheet.create({
  choice: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 18, borderWidth: 1 },
  choiceOn: { borderWidth: 2 },
  label: { fontFamily: 'DMSans-Bold', fontSize: 20 },
  hint: { fontFamily: 'DMSans-Regular', fontSize: 14, marginTop: 2 },
  radio: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
