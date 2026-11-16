// The frame every setup screen uses: "Step 2 of 4" with progress dots, a Back button,
// title, scrolling content and the buttons fixed at the bottom. Full screens, no swipe sheets.
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
import { useT } from '../../lib/i18n';

type Props = {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
};

export default function SetupFrame({ step, total, title, subtitle, onBack, footer, children }: Props) {
  const { colors } = useAppTheme();
  const t = useT();

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <View style={styles.top}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.back} accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={8}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.back} />
        )}
        <View style={styles.dots} accessibilityLabel={t('common.stepOf', { step, total })}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i < step ? colors.brandBlue : colors.cardBorder }, i === step - 1 && styles.dotNow]} />
          ))}
        </View>
        <Text style={[styles.stepText, { color: colors.textMuted }]}>{t('common.stepOf', { step, total })}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{title}</Text>
        {!!subtitle && <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>}
        {children}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.cardBorder, backgroundColor: colors.bg }]}>{footer}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, gap: 12 },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  dots: { flex: 1, flexDirection: 'row', gap: 6 },
  dot: { flex: 1, height: 5, borderRadius: 3 },
  dotNow: { height: 6 },
  stepText: { fontFamily: 'DMSans-Medium', fontSize: 12 },
  body: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24, gap: 12 },
  title: { fontFamily: 'DMSans-Bold', fontSize: 26, lineHeight: 32 },
  subtitle: { fontFamily: 'DMSans-Regular', fontSize: 15, lineHeight: 21, marginBottom: 8 },
  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
});
