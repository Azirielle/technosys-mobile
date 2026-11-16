// The second way in: email (or username) + password. Same one-phone rule for technicians and helpers.
import React, { useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Keyboard } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getLoginStyles } from './loginStyles';
import { signInWithEmail } from '../../lib/signIn';

type Props = {
  colors: any;
  isDark: boolean;
  onSignedIn: () => void;
  onOtherPhone: () => void;
  onUsePhone: () => void;
};

export default function EmailSignInForm({ colors, isDark, onSignedIn, onOtherPhone, onUsePhone }: Props) {
  const styles = useMemo(() => getLoginStyles(colors, isDark), [colors, isDark]);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        <View style={styles.errorBox} accessibilityLiveRegion="polite">
          <Feather name="alert-circle" size={16} color={styles.errorText.color as string} style={{ marginTop: 1 }} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Text style={styles.label}>Email or username</Text>
      <View style={[styles.inputWrapper, !!error && !identifier.trim() && styles.inputWrapperError]}>
        <Feather name="mail" size={20} color={colors.textMuted} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="name@gmail.com"
          placeholderTextColor={colors.textSubtle}
          value={identifier}
          onChangeText={t => { setIdentifier(t); setError(null); }}
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
      <View style={[styles.inputWrapper, !!error && !password && styles.inputWrapperError]}>
        <Feather name="lock" size={20} color={colors.textMuted} style={styles.inputIcon} />
        <TextInput
          ref={passwordRef}
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textSubtle}
          value={password}
          onChangeText={t => { setPassword(t); setError(null); }}
          secureTextEntry={!showPassword}
          textContentType="password"
          autoComplete="password"
          returnKeyType="go"
          onSubmitEditing={submit}
          editable={!busy}
          accessibilityLabel="Password"
        />
        <TouchableOpacity onPress={() => setShowPassword(s => !s)} accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} hitSlop={10}>
          <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={submit}
        disabled={busy}
        activeOpacity={0.8}
        accessibilityRole="button"
      >
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Sign in</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.switchLink} onPress={onUsePhone} disabled={busy} accessibilityRole="button">
        <Feather name="smartphone" size={16} color={styles.switchText.color as string} />
        <Text style={styles.switchText}>Sign in with mobile number</Text>
      </TouchableOpacity>
    </View>
  );
}
