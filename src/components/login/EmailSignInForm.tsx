// The second way in: email (or username) + password. Same one-phone rule for technicians and helpers.
import React, { useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Keyboard, Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { getLoginStyles } from './loginStyles';
import { signInWithEmail } from '../../lib/signIn';
import { Button, Notice, useTokens } from '../../ui';

type Props = {
  onSignedIn: () => void;
  onOtherPhone: () => void;
  onUsePhone: () => void;
};

export default function EmailSignInForm({ onSignedIn, onOtherPhone, onUsePhone }: Props) {
  const { c, isDark } = useTokens();
  const styles = useMemo(() => getLoginStyles(c, isDark), [c, isDark]);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focus, setFocus] = useState<'id' | 'pw' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    if (busy) return;
    if (!identifier.trim() || !password) {
      setError('Enter your email (or username) and your password.');
      return;
    }
    setError(null);
    setBusy(true);
    Keyboard.dismiss();
    const result = await signInWithEmail(identifier, password);
    setBusy(false);
    if (result.ok) return onSignedIn();
    if (result.reason === 'other_phone') return onOtherPhone();
    if (result.reason === 'message') setError(result.message);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Sign in with email</Text>
      <Text style={styles.hint}>Your email or username, and your password.</Text>

      {error && (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={{ marginBottom: 16 }}>
          <Notice tone="error" text={error} />
        </Animated.View>
      )}

      <Text style={styles.label}>Email or username</Text>
      <View style={[styles.inputWrapper, focus === 'id' && styles.inputWrapperFocus, !!error && !identifier.trim() && styles.inputWrapperError]}>
        <Feather name="mail" size={20} color={focus === 'id' ? c.brand : c.ink3} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="name@gmail.com"
          placeholderTextColor={c.ink3}
          value={identifier}
          onChangeText={(t) => { setIdentifier(t); setError(null); }}
          onFocus={() => setFocus('id')}
          onBlur={() => setFocus(null)}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          autoComplete="email"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          editable={!busy}
          accessibilityLabel="Email or username"
        />
      </View>

      <Text style={styles.label}>Password</Text>
      <View style={[styles.inputWrapper, focus === 'pw' && styles.inputWrapperFocus, !!error && !password && styles.inputWrapperError]}>
        <Feather name="lock" size={20} color={focus === 'pw' ? c.brand : c.ink3} style={styles.inputIcon} />
        <TextInput
          ref={passwordRef}
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={c.ink3}
          value={password}
          onChangeText={(t) => { setPassword(t); setError(null); }}
          onFocus={() => setFocus('pw')}
          onBlur={() => setFocus(null)}
          secureTextEntry={!showPassword}
          textContentType="password"
          autoComplete="password"
          returnKeyType="go"
          onSubmitEditing={submit}
          editable={!busy}
          accessibilityLabel="Password"
        />
        <Pressable onPress={() => setShowPassword((s) => !s)} accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} hitSlop={10}>
          <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color={c.ink3} />
        </Pressable>
      </View>

      <Button label="Sign in" onPress={submit} loading={busy} />

      <Pressable style={styles.switchLink} onPress={onUsePhone} disabled={busy} accessibilityRole="button">
        <Feather name="smartphone" size={16} color={c.brand} />
        <Text style={styles.switchText}>Sign in with mobile number</Text>
      </Pressable>
    </View>
  );
}
