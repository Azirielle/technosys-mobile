// Four PIN boxes (dots) over one hidden number field. Each dot pops in as you type; the row shakes
// gently when the PIN is wrong (motion #11). Calls onComplete when all 4 digits are typed.
import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import Animated, { ZoomIn, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { haptic, useReducedMotion, useTokens } from '../../ui';

type Props = {
  value: string;
  onChange: (pin: string) => void;
  onComplete?: (pin: string) => void;
  hasError?: boolean;
  disabled?: boolean;
};

export type PinBoxesHandle = { focus: () => void };

const PinBoxes = forwardRef<PinBoxesHandle, Props>(({ value, onChange, onComplete, hasError, disabled }, ref) => {
  const { c, radius } = useTokens();
  const reduced = useReducedMotion();
  const inputRef = useRef<TextInput>(null);
  const shake = useSharedValue(0);
  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }));

  useEffect(() => {
    if (!hasError) return;
    haptic.error();
    if (!reduced) shake.value = withSequence(...[6, -6, 6, -6, 0].map((x) => withTiming(x, { duration: 50 })));
  }, [hasError, reduced, shake]);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 4);
    onChange(digits);
    if (digits.length === 4) onComplete?.(digits);
  };

  return (
    <Pressable onPress={() => inputRef.current?.focus()} accessibilityLabel="4-digit PIN" accessibilityHint="Type your PIN">
      <Animated.View style={[styles.row, shakeStyle]}>
        {[0, 1, 2, 3].map((i) => {
          const filled = i < value.length;
          const active = i === value.length && !disabled;
          return (
            <View
              key={i}
              style={[
                styles.box,
                { borderRadius: radius.control, backgroundColor: filled ? c.tint : c.cardSoft, borderColor: 'transparent' },
                active && { borderColor: c.brand, backgroundColor: c.card },
                hasError && { borderColor: c.error },
              ]}
            >
              {filled && <Animated.View entering={reduced ? undefined : ZoomIn.springify().damping(14)} style={[styles.dot, { backgroundColor: c.brand }]} />}
            </View>
          );
        })}
      </Animated.View>
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
  box: { width: 58, height: 64, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7 },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
