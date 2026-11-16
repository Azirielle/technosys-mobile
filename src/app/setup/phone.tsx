// Setup step (technicians and helpers): make this phone their work phone, on purpose.
// Registering plays the success check (motion #10). If the account already has another phone,
// they can only ask HR to switch it.
import React, { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRouter, type Href } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useT } from '../../lib/i18n';
import { getDeviceName } from '../../lib/deviceId';
import { registerThisPhone, requestPhoneChangeAndSignOut } from '../../lib/signIn';
import { goAfter, stepNumber } from '../../lib/setup';
import { supabase } from '../../lib/supabase';
import SetupFrame from '../../components/setup/SetupFrame';
import SetupButton from '../../components/setup/SetupButton';
import NoticeBox from '../../components/setup/NoticeBox';
import OtherPhoneNotice from '../../components/login/OtherPhoneNotice';
import { Glass, GlowScreen, SuccessCheck, Techy, Txt, arrive, useReducedMotion, useTokens } from '../../ui';

export default function PhoneStep() {
  const router = useRouter();
  const t = useT();
  const { c } = useTokens();
  const reduced = useReducedMotion();
  const { step, total } = stepNumber('phone');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otherPhone, setOtherPhone] = useState(false);

  const register = async () => {
    setBusy(true);
    setError(null);
    const result = await registerThisPhone();
    setBusy(false);
    if (result === 'ok') {
      setDone(true);                                   // success check, then the next step
      setTimeout(() => goAfter(router, 'phone'), reduced ? 300 : 1100);
      return;
    }
    if (result === 'other_phone') return setOtherPhone(true);
    setError(t('common.noSignal'));
  };

  // Someone registered another phone for this account first (rare): same choice as at sign-in.
  if (otherPhone) {
    return (
      <GlowScreen style={{ justifyContent: 'center', padding: 20 }}>
        <OtherPhoneNotice
          onRequest={requestPhoneChangeAndSignOut}
          onBack={async () => {
            await supabase.auth.signOut().catch(() => {});
            router.replace('/' as Href);
          }}
        />
      </GlowScreen>
    );
  }

  const points = [t('setup.phone.point1'), t('setup.phone.point2'), t('setup.phone.point3')];

  return (
    <SetupFrame
      step={step}
      total={total}
      title={t('setup.phone.title')}
      subtitle={t('setup.phone.subtitle')}
      onBack={router.canGoBack() && !done ? router.back : undefined}
      footer={
        <>
          {error && <NoticeBox kind="error" text={error} />}
          <SetupButton label={t('setup.phone.register')} onPress={register} busy={busy} disabled={done} />
        </>
      }
    >
      <Animated.View entering={arrive(1, reduced)}>
        <Glass style={{ alignItems: 'center', padding: 22, marginBottom: 4 }}>
          {done ? (
            <Animated.View entering={FadeIn.duration(150)} style={{ alignItems: 'center', gap: 10, paddingVertical: 14 }}>
              <SuccessCheck size={64} />
              <Txt variant="heading" color="ok">{t('setup.phone.registered')}</Txt>
            </Animated.View>
          ) : (
            <>
              <Techy mood="wave" size={110} />
              <Txt variant="caption" color="ink2" style={{ marginTop: 6 }}>{t('setup.phone.thisPhone')}</Txt>
              <Txt variant="title" center style={{ fontSize: 20 }}>{getDeviceName()}</Txt>
            </>
          )}
        </Glass>
      </Animated.View>

      {points.map((p, i) => (
        <Animated.View key={p} entering={arrive(i + 2, reduced)} style={{ flexDirection: 'row', gap: 10 }}>
          <Feather name="check" size={18} color={c.ok} style={{ marginTop: 2 }} />
          <Txt variant="body" style={{ flex: 1, lineHeight: 22 }}>{p}</Txt>
        </Animated.View>
      ))}
    </SetupFrame>
  );
}
