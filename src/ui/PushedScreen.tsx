// PushedScreen: the frame for every full screen opened on top of a tab (My tools, Leave, Updates, job details,
// Ask HR…): back arrow, big title, optional line under it, scrolling content, and an optional button pinned at
// the bottom. It slides in from the right and Back slides it away (root stack), so all of them move the same.
import React from 'react';
import { KeyboardAvoidingView, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackHeader from './BackHeader';
import Txt from './Txt';
import { useTokens } from './useTokens';

type Props = {
  title: string;
  subtitle?: string;
  backLabel: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
};

export default function PushedScreen({ title, subtitle, backLabel, children, footer, onRefresh, refreshing }: Props) {
  const { c, space } = useTokens();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={['top', 'bottom']}>
      <BackHeader label={backLabel} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" /* Android draws edge-to-edge and no longer resizes for the keyboard */>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.brand} colors={[c.brand]} /> : undefined}
        >
          <Txt variant="title" accessibilityRole="header">{title}</Txt>
          {!!subtitle && <Txt variant="body" color="ink2" style={{ marginTop: 4 }}>{subtitle}</Txt>}
          <View style={{ marginTop: 8 }}>{children}</View>
        </ScrollView>
        {footer && <View style={{ paddingHorizontal: space.lg, paddingTop: 8, paddingBottom: 12 }}>{footer}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
