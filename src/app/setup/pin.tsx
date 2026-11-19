// Setup step (technicians and helpers): replace HR's temporary PIN with your own, like GCash's MPIN.
// Comes back after HR resets a forgotten PIN. Then offers fingerprint / face sign-in when the phone has it.
import React from 'react';
import { useRouter } from 'expo-router';
import { useT } from '../../lib/i18n';
import { goAfter, stepNumber } from '../../lib/setup';
import SetupFrame from '../../components/setup/SetupFrame';
import MakePinFlow from '../../components/pin/MakePinFlow';

export default function PinStep() {
  const router = useRouter();
  const t = useT();
  const { step, total } = stepNumber('pin');
  return (
    <SetupFrame step={step} total={total} title={t('setup.pin.title')} subtitle={t('setup.pin.subtitle')} footer={null}>
      <MakePinFlow needsCurrent={false} onDone={() => goAfter(router, 'pin')} />
    </SetupFrame>
  );
}
