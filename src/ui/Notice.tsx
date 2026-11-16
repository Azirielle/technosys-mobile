// Notice: a message box in a status color (problem, pending, OK or information), with an icon.
import React from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Txt from './Txt';
import { useTokens } from './useTokens';
import type { Tone } from './Status';

const ICONS = { ok: 'check-circle', pending: 'clock', error: 'alert-circle', info: 'info' } as const;

export default function Notice({ tone, text }: { tone: Tone; text: string }) {
  const { c, radius } = useTokens();
  const [fg, bg] = { ok: [c.ok, c.okBg], pending: [c.pending, c.pendingBg], error: [c.error, c.errorBg], info: [c.info, c.infoBg] }[tone];
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.control, backgroundColor: bg }}>
      <Feather name={ICONS[tone]} size={18} color={fg} style={{ marginTop: 1 }} />
      <Txt variant="body" style={{ flex: 1, color: fg, fontSize: 14, lineHeight: 20 }}>{text}</Txt>
    </View>
  );
}
