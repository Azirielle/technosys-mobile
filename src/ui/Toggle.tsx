// Toggle: an on/off switch in the app's colors (blue when on). Used for settings like "Vibrate on tap".
import React from 'react';
import { Switch } from 'react-native';
import { useTokens } from './useTokens';

export default function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const { c } = useTokens();
  return (
    <Switch value={value} onValueChange={onChange} accessibilityLabel={label}
      trackColor={{ false: c.line, true: c.brand }} thumbColor={c.card} ios_backgroundColor={c.line} />
  );
}
