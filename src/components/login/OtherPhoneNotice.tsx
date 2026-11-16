// Shown when the details are right but the account is registered to another phone.
// The only way forward is asking HR to switch the account to this phone.
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getLoginStyles, LOGIN_BRAND } from './loginStyles';

type Props = {
  colors: any;
  isDark: boolean;
  /** Sends the request; returns false if it couldn't be sent */
  onRequest: () => Promise<boolean>;
  onBack: () => void;
};

export default function OtherPhoneNotice({ colors, isDark, onRequest, onBack }: Props) {
  const styles = useMemo(() => getLoginStyles(colors, isDark), [colors, isDark]);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const send = async () => {
    setState('sending');
    setState((await onRequest()) ? 'sent' : 'failed');
  };

  if (state === 'sent') {
    return (
      <View style={styles.card}>
        <View style={[local.icon, { backgroundColor: isDark ? 'rgba(5, 150, 105, 0.2)' : '#ECFDF5' }]}>
          <Feather name="check" size={28} color={LOGIN_BRAND.green} />
        </View>
        <Text style={styles.title}>Request sent to HR</Text>
        <Text style={[styles.hint, { marginBottom: 8 }]}>
          When HR approves it, sign in again on this phone. Your old phone will stop working for your account.
        </Text>
        <TouchableOpacity style={styles.button} onPress={onBack} accessibilityRole="button">
          <Text style={styles.buttonText}>OK</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={[local.icon, { backgroundColor: isDark ? 'rgba(251, 191, 36, 0.18)' : '#FEF3C7' }]}>
        <Feather name="smartphone" size={28} color="#B45309" />
      </View>
      <Text style={styles.title}>This isn't your registered phone</Text>
      <Text style={styles.hint}>
        Your account only works on the phone you first signed in on, so nobody can time in for someone else.
        Got a new phone? Ask HR to switch your account to this one.
      </Text>

      {state === 'failed' && (
        <View style={styles.errorBox} accessibilityLiveRegion="polite">
          <Feather name="alert-circle" size={16} color={styles.errorText.color as string} style={{ marginTop: 1 }} />
          <Text style={styles.errorText}>Couldn't send the request. Check your signal and try again.</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, state === 'sending' && styles.buttonDisabled]}
        onPress={send}
        disabled={state === 'sending'}
        accessibilityRole="button"
      >
        {state === 'sending' ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Ask HR to use this phone</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={onBack} disabled={state === 'sending'} accessibilityRole="button">
        <Text style={styles.secondaryButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const local = StyleSheet.create({
  icon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14 },
});
