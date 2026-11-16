// A coloured message box on setup screens: a problem (red), a warning (amber) or done (green).
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';

const KINDS = {
  error: { icon: 'alert-circle' as const, color: '#DC2626', light: '#FEF2F2', dark: 'rgba(220, 38, 38, 0.15)' },
  warning: { icon: 'alert-triangle' as const, color: '#B45309', light: '#FFFBEB', dark: 'rgba(245, 158, 11, 0.15)' },
  success: { icon: 'check-circle' as const, color: '#059669', light: '#ECFDF5', dark: 'rgba(5, 150, 105, 0.15)' },
};

export default function NoticeBox({ kind, text }: { kind: keyof typeof KINDS; text: string }) {
  const { isDark } = useAppTheme();
  const k = KINDS[kind];
  return (
    <View style={[styles.box, { backgroundColor: isDark ? k.dark : k.light }]} accessibilityLiveRegion="polite">
      <Feather name={k.icon} size={18} color={k.color} style={{ marginTop: 1 }} />
      <Text style={[styles.text, { color: isDark ? '#F1F5F9' : '#1F2937' }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14 },
  text: { flex: 1, fontFamily: 'DMSans-Medium', fontSize: 14, lineHeight: 20 },
});
