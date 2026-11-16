// Shown when the details are right but the account is registered to another phone.
// The only way forward is asking HR to switch the account to this phone.
import React, { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { getLoginStyles } from './loginStyles';
import { Button, Notice, SuccessCheck, Techy, useTokens } from '../../ui';

type Props = {
  /** Sends the request; returns false if it couldn't be sent */
  onRequest: () => Promise<boolean>;
  onBack: () => void;
};

export default function OtherPhoneNotice({ onRequest, onBack }: Props) {
  const { c, isDark } = useTokens();
  const styles = useMemo(() => getLoginStyles(c, isDark), [c, isDark]);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const send = async () => {
    setState('sending');
    setState((await onRequest()) ? 'sent' : 'failed');
  };

  if (state === 'sent') {
    return (
      <Animated.View entering={FadeIn.duration(220)} style={styles.card}>
        <View style={{ alignItems: 'center', marginBottom: 14 }}><SuccessCheck size={60} /></View>
        <Text style={styles.title}>Request sent to HR</Text>
        <Text style={[styles.hint, { marginBottom: 16 }]}>
          When HR approves it, sign in again on this phone. Your old phone will stop working for your account.
        </Text>
        <Button label="OK" onPress={onBack} />
      </Animated.View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={{ alignItems: 'center', marginBottom: 8 }}><Techy mood="worry" size={104} /></View>
      <Text style={styles.title}>This isn't your registered phone</Text>
      <Text style={styles.hint}>
        Your account works on one registered phone, so nobody can time in for someone else.
        Got a new phone? Ask HR to switch your account to this one.
      </Text>

      {state === 'failed' && (
        <View style={{ marginBottom: 16 }}><Notice tone="error" text="Couldn't send the request. Check your signal and try again." /></View>
      )}

      <View style={{ gap: 10 }}>
        <Button label="Ask HR to use this phone" onPress={send} loading={state === 'sending'} />
        <Button kind="secondary" label="Back" onPress={onBack} disabled={state === 'sending'} />
      </View>
    </View>
  );
}
