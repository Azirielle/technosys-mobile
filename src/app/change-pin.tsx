// Profile → Change PIN (current PIN, then the new one twice) or ?fingerprint=1 (current PIN, then the fingerprint).
import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useT } from '../lib/i18n';
import MakePinFlow from '../components/pin/MakePinFlow';
import { PushedScreen } from '../ui';

export default function ChangePinScreen() {
  const router = useRouter();
  const t = useT();
  const { fingerprint } = useLocalSearchParams<{ fingerprint?: string }>();
  const only = fingerprint === '1';
  return (
    <PushedScreen title={t(only ? 'pin.bioTitle' : 'pin.changeTitle')} backLabel={t('common.back')}>
      <MakePinFlow needsCurrent fingerprintOnly={only} onDone={() => router.back()} />
    </PushedScreen>
  );
}
