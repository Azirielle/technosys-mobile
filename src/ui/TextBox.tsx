// TextBox: a plain multi-line text field with a label above it (notes to HR, tool problems).
import React from 'react';
import { TextInput, View } from 'react-native';
import Txt from './Txt';
import { useTokens } from './useTokens';

type Props = { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; maxLength?: number };

export default function TextBox({ label, value, onChangeText, placeholder, maxLength = 500 }: Props) {
  const { c, radius, fonts } = useTokens();
  return (
    <View style={{ gap: 6 }}>
      <Txt variant="label">{label}</Txt>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={c.ink3}
        multiline maxLength={maxLength} textAlignVertical="top" accessibilityLabel={label}
        style={{ minHeight: 96, padding: 14, borderRadius: radius.control, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, color: c.ink, fontFamily: fonts.regular, fontSize: 15 }} />
    </View>
  );
}
