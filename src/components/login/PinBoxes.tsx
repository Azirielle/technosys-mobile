// Four PIN boxes (dots) over one hidden number field. Calls onComplete when all 4 digits are typed.
import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import { View, TextInput, Pressable, StyleSheet, Text } from 'react-native';
import { LOGIN_BRAND } from './loginStyles';

type Props = {
  value: string;
  onChange: (pin: string) => void;
  onComplete?: (pin: string) => void;
  colors: any;
  hasError?: boolean;
  disabled?: boolean;
};

export type PinBoxesHandle = { focus: () => void };

const PinBoxes = forwardRef<PinBoxesHandle, Props>(({ value, onChange, onComplete, colors, hasError, disabled }, ref) => {
  const inputRef = useRef<TextInput>(null);
  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }));

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 4);
    onChange(digits);
    if (digits.length === 4) onComplete?.(digits);
  };

  return (
    <Pressable onPress={() => inputRef.current?.focus()} accessibilityLabel="4-digit PIN" accessibilityHint="Type your PIN">
      <View style={styles.row}>
        {[0, 1, 2, 3].map(i => {
          const filled = i < value.length;
          const active = i === value.length && !disabled;
          return (
            <View
              key={i}
              style={[
                styles.box,
                { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                active && { borderColor: LOGIN_BRAND.blue, borderWidth: 2 },
                hasError && { borderColor: LOGIN_BRAND.red },
              ]}
            >
              {filled ? <View style={[styles.dot, { backgroundColor: colors.text }]} /> : <Text style={styles.empty}> </Text>}
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={4}
        secureTextEntry
        editable={!disabled}
        textContentType="oneTimeCode"
        autoComplete="off"
        style={styles.hidden}
        caretHidden
      />
    </Pressable>
  );
});

PinBoxes.displayName = 'PinBoxes';
export default PinBoxes;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: 20 },
  box: { width: 56, height: 62, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7 },
  empty: { fontSize: 1 },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
