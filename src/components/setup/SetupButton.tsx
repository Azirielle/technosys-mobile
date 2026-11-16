// The big bottom button on setup screens (primary = blue, or a plain outlined one).
import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useAppTheme } from '../../context/ThemeContext';

type Props = { label: string; onPress: () => void; kind?: 'primary' | 'plain'; disabled?: boolean; busy?: boolean };

export default function SetupButton({ label, onPress, kind = 'primary', disabled, busy }: Props) {
  const { colors } = useAppTheme();
  const primary = kind === 'primary';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || busy}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || busy) }}
      style={[
        styles.button,
        primary ? { backgroundColor: colors.brandBlue } : { borderWidth: 1, borderColor: colors.cardBorder },
        (disabled || busy) && styles.dimmed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? '#FFFFFF' : colors.text} />
      ) : (
        <Text style={[styles.text, { color: primary ? '#FBBF24' : colors.text }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  dimmed: { opacity: 0.5 },
  text: { fontFamily: 'DMSans-Bold', fontSize: 16 },
});
