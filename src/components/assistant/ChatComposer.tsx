// ChatComposer: the typing box and round send button at the bottom of a chat (Techy's chat, and a conversation with HR).
import React from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTokens } from '../../ui';

type Props = { value: string; onChangeText: (v: string) => void; onSend: () => void; placeholder: string; sendLabel: string; busy?: boolean };

export default function ChatComposer({ value, onChangeText, onSend, placeholder, sendLabel, busy }: Props) {
  const { c, radius, fonts } = useTokens();
  const off = !value.trim() || !!busy;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: c.line }}>
      <TextInput value={value} onChangeText={onChangeText} multiline maxLength={1000} placeholder={placeholder} placeholderTextColor={c.ink3}
        accessibilityLabel={placeholder}
        style={{ flex: 1, maxHeight: 120, minHeight: 44, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 11, borderRadius: radius.control, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, color: c.ink, fontFamily: fonts.regular, fontSize: 15 }} />
      <Pressable onPress={onSend} disabled={off} accessibilityRole="button" accessibilityLabel={sendLabel}
        style={{ width: 44, height: 44, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center', backgroundColor: c.brand, opacity: off ? 0.4 : 1 }}>
        <Feather name="send" size={19} color={c.onBrand} />
      </Pressable>
    </View>
  );
}
