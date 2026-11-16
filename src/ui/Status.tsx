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

/** A pill with an optional dot: "Waiting for HR", "Timed in · 8:02 AM". */
export function StatusPill({ tone, label, dot = true }: { tone: Tone; label: string; dot?: boolean }) {
  const { c } = useTokens();
  const [fg, bg] = toneColors(c, tone);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: bg }}>
      {dot && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: fg }} />}
      <Txt variant="label" style={{ color: fg, fontSize: 12 }}>{label}</Txt>
    </View>
  );
}

/** Just the colored words, for the right side of a row: "Due back today". */
export function StatusText({ tone, label }: { tone: Tone; label: string }) {
  const { c } = useTokens();
  return <Txt variant="label" style={{ color: toneColors(c, tone)[0], fontSize: 12 }}>{label}</Txt>;
}
