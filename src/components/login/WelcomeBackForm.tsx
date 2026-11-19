// "Welcome back, Juan": the sign-in on a phone that remembers its technician (like GCash). Only the PIN, or the
// fingerprint / face when it's turned on (asked once as the screen opens). "Not Juan?" goes back to the full form.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Keyboard } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import PinBoxes, { type PinBoxesHandle } from './PinBoxes';
import { getLoginStyles } from './loginStyles';
import { signInWithPin, type SignInResult } from '../../lib/signIn';
import { biometricOn, signInWithBiometric, type Remembered } from '../../lib/quickSignIn';
import { useT } from '../../lib/i18n';
import { Button, Notice, useTokens } from '../../ui';

type Props = {
  who: Remembered;
  onSignedIn: () => void;
  onOtherPhone: (mobile: string, pin: string) => void;
  onNotYou: () => void;
};

export default function WelcomeBackForm({ who, onSignedIn, onOtherPhone, onNotYou }: Props) {
  const t = useT();
  const { c, isDark } = useTokens();
  const styles = useMemo(() => getLoginStyles(c, isDark), [c, isDark]);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bio, setBio] = useState(false);
  const pinRef = useRef<PinBoxesHandle>(null);
  const name = who.firstName || t('login.there');

  const handle = (result: SignInResult | null, pinValue: string) => {
    if (!result) return; // fingerprint cancelled: the PIN boxes are still there
    if (result.ok) return onSignedIn();
    if (result.reason === 'other_phone') return onOtherPhone(who.mobile, pinValue);
    if (result.reason === 'message') { setError(result.message); setPin(''); }
  };

  const withPin = async (p: string) => {
    if (busy) return;
    setBusy(true); setError(null); Keyboard.dismiss();
    handle(await signInWithPin(who.mobile, p), p);
    setBusy(false);
  };

  const withFingerprint = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    const result = await signInWithBiometric(who, t('pin.bioPrompt'));
    setBusy(false);
    if (result && !result.ok) setBio(await biometricOn()); // an old saved PIN turns the fingerprint off
    handle(result, '');
  };

  useEffect(() => {
    biometricOn().then((on) => { setBio(on); if (on) withFingerprint(); else setTimeout(() => pinRef.current?.focus(), 300); });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ask for the fingerprint once, when the screen opens
  }, []);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('login.welcome', { name })}</Text>
      <Text style={styles.hint}>{t('login.pinOnly')}</Text>

      {error && (
        <Animated.View entering={FadeIn.duration(150)} style={{ marginBottom: 16 }}>
          <Notice tone="error" text={error} />
        </Animated.View>
      )}

      <PinBoxes ref={pinRef} value={pin} onChange={(p) => { setPin(p); if (error) setError(null); }}
        onComplete={withPin} hasError={!!error} disabled={busy} />

      {bio && <Button label={t('login.useFingerprint')} icon="unlock" kind="secondary" onPress={withFingerprint} loading={busy} />}

      <Pressable style={styles.switchLink} onPress={onNotYou} disabled={busy} accessibilityRole="button">
        <Text style={styles.switchHint}>{t('login.notYou', { name })}</Text>
        <Text style={styles.switchText}>{t('login.useAnother')}</Text>
      </Pressable>
    </View>
  );
}
