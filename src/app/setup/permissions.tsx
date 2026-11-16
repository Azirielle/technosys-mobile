// Setup step: explain location, camera and notifications in plain words, then let Android ask.
// Saying no never blocks finishing setup, but time-in needs location, so we say so plainly.
import React, { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useT } from '../../lib/i18n';
import { getPermissionStates, openPhoneSettings, requestMissingPermissions, type PermissionState, type PermissionStates } from '../../lib/permissions';
import { markPermissionsDone, stepNumber } from '../../lib/setup';
import SetupFrame from '../../components/setup/SetupFrame';
import SetupButton from '../../components/setup/SetupButton';
import InfoCard from '../../components/setup/InfoCard';
import NoticeBox from '../../components/setup/NoticeBox';

export default function PermissionsStep() {
  const router = useRouter();
  const t = useT();
  const { step, total } = stepNumber('permissions');
  const [states, setStates] = useState<PermissionStates | null>(null);
  const [asked, setAsked] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => setStates(await getPermissionStates()), []);
  useEffect(() => {
    refresh();
    // Coming back from the phone's settings: show the new answers
    const sub = AppState.addEventListener('change', s => { if (s === 'active') refresh(); });
    return () => sub.remove();
  }, [refresh]);

  const status = (s: PermissionState | undefined) =>
    s === 'granted' ? { label: t('setup.permissions.allowed'), tone: 'good' as const }
    : s === 'denied' ? { label: t('setup.permissions.notAllowed'), tone: 'bad' as const }
    : { label: t('setup.permissions.notAsked'), tone: 'neutral' as const };

  const allow = async () => {
    setBusy(true);
    setStates(await requestMissingPermissions());
    setAsked(true);
    setBusy(false);
  };

  const finish = async () => {
    await markPermissionsDone();
    router.replace('/(tabs)' as Href);
  };

  const allGranted = !!states && Object.values(states).every(s => s === 'granted' || s === 'unavailable');
  const locationMissing = !!states && states.location !== 'granted';
  const askedAlready = asked || (!!states && Object.values(states).every(s => s !== 'undetermined'));

  return (
    <SetupFrame
      step={step}
      total={total}
      title={t('setup.permissions.title')}
      subtitle={t('setup.permissions.subtitle')}
      onBack={router.canGoBack() ? router.back : undefined}
      footer={
        allGranted ? (
          <SetupButton label={t('setup.permissions.finish')} onPress={finish} />
        ) : askedAlready ? (
          <>
            <SetupButton label={t('setup.permissions.openSettings')} onPress={openPhoneSettings} />
            <SetupButton kind="plain" label={t('setup.permissions.finishAnyway')} onPress={finish} />
          </>
        ) : (
          <SetupButton label={t('setup.permissions.allow')} onPress={allow} busy={busy || !states} />
        )
      }
    >
      <InfoCard index={1} icon="map-pin" title={t('setup.permissions.locationTitle')} text={t('setup.permissions.locationText')} status={states ? status(states.location) : undefined} />
      <InfoCard index={2} icon="camera" title={t('setup.permissions.cameraTitle')} text={t('setup.permissions.cameraText')} status={states ? status(states.camera) : undefined} />
      {states?.notifications === 'unavailable' ? (
        <InfoCard index={3} icon="bell" title={t('setup.permissions.notificationsTitle')} text={t('setup.permissions.notificationsLater')} />
      ) : (
        <InfoCard index={3} icon="bell" title={t('setup.permissions.notificationsTitle')} text={t('setup.permissions.notificationsText')} status={states ? status(states.notifications) : undefined} />
      )}
      {askedAlready && locationMissing && <NoticeBox kind="warning" text={t('setup.permissions.locationNeeded')} />}
    </SetupFrame>
  );
}
