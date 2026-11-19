// MakePinFlow: making your own 4-digit PIN, one step at a time: (your current PIN, when changing one) → a new PIN →
// the same PIN again → saved. Then, if the phone has a fingerprint or face set up, offers to sign in with it.
// Used by first-time setup (app/setup/pin.tsx) and Profile → Change PIN / Fingerprint (app/change-pin.tsx). With
// fingerprintOnly it just checks the current PIN (a normal PIN sign-in) and turns fingerprint sign-in on.
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useT } from '../../lib/i18n';
import { biometricAvailable, getRemembered, setMyPin, turnBiometricOn } from '../../lib/quickSignIn';
import { signInWithPin } from '../../lib/signIn';
import PinBoxes, { type PinBoxesHandle } from '../login/PinBoxes';
import { Button, Notice, Techy, Txt, arrive, haptic, useReducedMotion } from '../../ui';

type Stage = 'current' | 'new' | 'repeat' | 'bio';
const WEAK = /^(\d)\1{3}$|^(1234|4321|0123|9876)$/; // same rule as the server's

type Props = { needsCurrent: boolean; fingerprintOnly?: boolean; onDone: () => void };

export default function MakePinFlow({ needsCurrent, fingerprintOnly, onDone }: Props) {
  const t = useT();
  const reduced = useReducedMotion();
  const [stage, setStage] = useState<Stage>(needsCurrent ? 'current' : 'new');
  const [pin, setPin] = useState('');
  const [current, setCurrent] = useState('');
  const [fresh, setFresh] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const boxes = useRef<PinBoxesHandle>(null);

  useEffect(() => { setTimeout(() => boxes.current?.focus(), 250); }, [stage]);

  const go = (next: Stage, problem: string | null = null) => { setPin(''); setError(problem); setStage(next); };

  const complete = async (p: string) => {
    if (stage === 'current' && fingerprintOnly) {
      const who = await getRemembered();
      setBusy(true);
      const check = who ? await signInWithPin(who.mobile, p) : null;
      setBusy(false);
      if (check?.ok) return (setFresh(p), go('bio'));
      return go('current', check && !check.ok && check.reason === 'message' ? check.message : t('pin.wrongCurrent'));
    }
    if (stage === 'current') return (setCurrent(p), go('new'));
    if (stage === 'new') return WEAK.test(p) ? go('new', t('pin.weak')) : (setFresh(p), go('repeat'));
    if (p !== fresh) return go('new', t('pin.mismatch'));
    setBusy(true);
    const result = await setMyPin(fresh, needsCurrent ? current : undefined);
    setBusy(false);
    if (result === 'saved') {
      haptic.success();
      return (await biometricAvailable()) ? go('bio') : onDone();
    }
    if (result === 'wrong_current') return go('current', t('pin.wrongCurrent'));
    if (result === 'weak') return go('new', t('pin.weak'));
    setPin(''); setError(t('common.noSignal'));
  };

  const useFingerprint = async () => {
    if (await turnBiometricOn(fresh, t('pin.bioPrompt'))) onDone();
    else setError(t('pin.bioFailed'));
  };

  if (stage === 'bio') {
    return (
      <Animated.View entering={arrive(0, reduced)} style={{ alignItems: 'center', gap: 14 }}>
        <Techy mood="cheer" size={110} />
        {!fingerprintOnly && <Txt variant="title" center>{t('pin.saved')}</Txt>}
        <Txt variant="body" color="ink2" center>{t('pin.bioOffer')}</Txt>
        {error && <Notice tone="error" text={error} />}
        <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 6 }}>
          <Button label={t('pin.bioUse')} icon="unlock" onPress={useFingerprint} />
          <Button label={t('pin.bioLater')} kind="ghost" onPress={onDone} />
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View key={stage} entering={arrive(0, reduced)} style={{ gap: 10 }}>
      <Txt variant="title" center>{t(stage === 'current' ? 'pin.currentTitle' : stage === 'new' ? 'pin.newTitle' : 'pin.repeatTitle')}</Txt>
      <Txt variant="body" color="ink2" center style={{ marginBottom: 12 }}>{t(stage === 'new' ? 'pin.newHint' : 'pin.otherHint')}</Txt>
      {error && <View style={{ marginBottom: 8 }}><Notice tone="error" text={error} /></View>}
      <PinBoxes ref={boxes} value={pin} onChange={(p) => { setPin(p); if (error) setError(null); }} onComplete={complete} hasError={!!error} disabled={busy} />
    </Animated.View>
  );
}
