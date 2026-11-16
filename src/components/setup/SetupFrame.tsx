// The frame every setup screen uses: progress bar with "Step 2 of 4", a Back button, title, scrolling
// content and the buttons fixed at the bottom. Full screens on the glow, no swipe sheets.
import React, { useEffect } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useT } from '../../lib/i18n';
import { GlowScreen, Txt, arrive, useReducedMotion, useTokens } from '../../ui';
import { easeOut as easeOutPreset } from '../../ui/motion';

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
  const { c } = useTokens();
  const t = useT();
  const reduced = useReducedMotion();
  const progress = useSharedValue(Math.max(0, step - 1) / Math.max(total, 1));
  useEffect(() => {
    progress.value = withTiming(step / Math.max(total, 1), { duration: reduced ? 0 : 450, easing: easeOutPreset });
  }, [step, total, reduced, progress]);
  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <GlowScreen>
      <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
        <View style={styles.top}>
          {onBack ? (
            <Pressable onPress={onBack} style={styles.back} accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={8}>
              <Feather name="arrow-left" size={22} color={c.ink} />
            </Pressable>
          ) : (
            <View style={styles.back} />
          )}
          <View style={[styles.track, { backgroundColor: c.accentSoft }]} accessibilityLabel={t('common.stepOf', { step, total })}>
            <Animated.View style={[styles.fill, { backgroundColor: c.accent }, fill]} />
          </View>
          <Txt variant="caption" color="ink2">{t('common.stepOf', { step, total })}</Txt>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Animated.View entering={arrive(0, reduced)}>
            <Txt variant="title" accessibilityRole="header" style={{ fontSize: 26, lineHeight: 32 }}>{title}</Txt>
            {!!subtitle && <Txt variant="body" color="ink2" style={{ marginTop: 6, marginBottom: 8 }}>{subtitle}</Txt>}
          </Animated.View>
          {children}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: c.line, backgroundColor: c.canvas }]}>{footer}</View>
      </SafeAreaView>
    </GlowScreen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, gap: 12 },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, gap: 12 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
});
