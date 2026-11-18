// Status words: the only place colors carry meaning. Green = OK, yellow = pending, red = problem,
// blue = information (the logo's arrows). Always words with the color, never color alone.
import React from 'react';
import { View } from 'react-native';
import Txt from './Txt';
import { useTokens } from './useTokens';

export type Tone = 'ok' | 'pending' | 'error' | 'info';

function toneColors(c: ReturnType<typeof useTokens>['c'], tone: Tone) {
  return { ok: [c.ok, c.okBg], pending: [c.pending, c.pendingBg], error: [c.error, c.errorBg], info: [c.info, c.infoBg] }[tone];
}

/** A pill with an optional dot: "Waiting for HR", "Timed in · 8:02 AM". `large` for the main status of a screen. */
export function StatusPill({ tone, label, dot = true, large }: { tone: Tone; label: string; dot?: boolean; large?: boolean }) {
  const { c } = useTokens();
  const [fg, bg] = toneColors(c, tone);
  const d = large ? 8 : 7;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: large ? 7 : 6, alignSelf: 'flex-start', paddingHorizontal: large ? 12 : 10, paddingVertical: large ? 5 : 4, borderRadius: 999, backgroundColor: bg }}>
      {dot && <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: fg }} />}
      <Txt variant="label" style={{ color: fg, fontSize: large ? 14 : 12, lineHeight: large ? 20 : 18 }}>{label}</Txt>
    </View>
  );
}

/** Just the colored words, for the right side of a row: "Due back today". */
export function StatusText({ tone, label }: { tone: Tone; label: string }) {
  const { c } = useTokens();
  return <Txt variant="label" style={{ color: toneColors(c, tone)[0], fontSize: 12 }}>{label}</Txt>;
}
