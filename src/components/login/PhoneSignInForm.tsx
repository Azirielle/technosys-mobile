// The first sign-in screen for technicians and helpers: mobile number + 4-digit PIN, no password.
import React, { useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Keyboard, Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import PinBoxes, { PinBoxesHandle } from './PinBoxes';
import { getLoginStyles } from './loginStyles';
import { isPhMobile, signInWithPin, SignInResult, toLocalNumber } from '../../lib/signIn';
import { Button, Notice, useTokens } from '../../ui';

type Props = {
  onSignedIn: () => void;
  /** Right number and PIN, but the account belongs to another phone */
  onOtherPhone: (mobile: string, pin: string) => void;
  onUseEmail: () => void;
};

export default function PhoneSignInForm({ onSignedIn, onOtherPhone, onUseEmail }: Props) {
  const { c, isDark } = useTokens();
  const styles = useMemo(() => getLoginStyles(c, isDark), [c, isDark]);
  const [mobile, setMobile] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState(false);
  const [error, setError] = useState<{ text: string; field: 'mobile' | 'pin' | null } | null>(null);
  const pinRef = useRef<PinBoxesHandle>(null);

  const submit = async (pinValue = pin) => {
    if (busy) return;
    if (!isPhMobile(mobile)) {
      setError({ text: 'Enter your 11-digit mobile number, e.g. 09171234567.', field: 'mobile' });
      return;
    }
    if (pinValue.length !== 4) {
      setError({ text: 'Enter your 4-digit PIN.', field: 'pin' });
      pinRef.current?.focus();
      return;
    }
    setError(null);
    setBusy(true);
    Keyboard.dismiss();
    const result: SignInResult = await signInWithPin(mobile, pinValue);
    setBusy(false);

    if (result.ok) return onSignedIn();
    if (result.reason === 'other_phone') return onOtherPhone(mobile, pinValue);
    if (result.reason === 'message') {
      const aboutNumber = /number/i.test(result.message);
      setError({ text: result.message, field: aboutNumber ? 'mobile' : /PIN/.test(result.message) ? 'pin' : null });
      setPin('');
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.hint}>Use the mobile number HR has for you.</Text>

      {error && (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={{ marginBottom: 16 }}>
          <Notice tone="error" text={error.text} />
        </Animated.View>
      )}

      <Text style={styles.label}>Mobile number</Text>
      <View style={[styles.inputWrapper, focus && styles.inputWrapperFocus, error?.field === 'mobile' && styles.inputWrapperError]}>
        <Feather name="smartphone" size={20} color={focus ? c.brand : c.ink3} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="09XX XXX XXXX"
          placeholderTextColor={c.ink3}
          value={mobile}
          onChangeText={(t) => { setMobile(toLocalNumber(t)); if (error?.field === 'mobile') setError(null); }}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          maxLength={16}
          returnKeyType="next"
          onSubmitEditing={() => pinRef.current?.focus()}
          editable={!busy}
          accessibilityLabel="Mobile number"
        />
      </View>

      <Text style={styles.label}>4-digit PIN</Text>
      <PinBoxes
        ref={pinRef}
        value={pin}
        onChange={(p) => { setPin(p); if (error?.field === 'pin') setError(null); }}
        onComplete={(p) => { if (isPhMobile(mobile)) submit(p); }}
        hasError={error?.field === 'pin'}
        disabled={busy}
      />

      <Button label="Sign in" onPress={() => submit()} loading={busy} />

      <Pressable style={styles.switchLink} onPress={onUseEmail} disabled={busy} accessibilityRole="button">
        <Text style={styles.switchHint}>Can't sign in with your number?</Text>
        <Text style={styles.switchText}>Sign in with email instead</Text>
      </Pressable>
    </View>
  );
}
