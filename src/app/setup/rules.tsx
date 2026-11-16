// Setup step: the app rules in four plain points, links to the full Terms of use and Privacy
// notice, and "I agree". Agreeing records a signature for both (HR sees it in Policies).
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useT } from '../../lib/i18n';
import { agreeToRules, goAfter, loadAppRules, stepNumber } from '../../lib/setup';
import SetupFrame from '../../components/setup/SetupFrame';
import SetupButton from '../../components/setup/SetupButton';
import InfoCard from '../../components/setup/InfoCard';
import NoticeBox from '../../components/setup/NoticeBox';
import PolicyReaderModal, { CompanyPolicy } from '../../components/PolicyReaderModal';
import { Card, ChoiceCard, ListRow, SkeletonRow, arrive, useReducedMotion } from '../../ui';

export default function RulesStep() {
  const router = useRouter();
  const t = useT();
  const reduced = useReducedMotion();
  const { step, total } = stepNumber('rules');
  const [rules, setRules] = useState<CompanyPolicy[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<CompanyPolicy | null>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      setRules(await loadAppRules());
    } catch {
      setLoadError(true);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const terms = rules?.find(r => r.id.startsWith('terms_of_service'));
  const privacy = rules?.find(r => r.id.startsWith('privacy_policy'));

  const next = async () => {
    if (!agreed) return setError(t('setup.rules.agreeFirst'));
    if (!rules) return;
    setSaving(true);
    setError(null);
    try {
      await agreeToRules(rules);
      goAfter(router, 'rules');
    } catch {
      setError(t('setup.rules.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SetupFrame
      step={step}
      total={total}
      title={t('setup.rules.title')}
      subtitle={t('setup.rules.subtitle')}
      onBack={router.canGoBack() ? router.back : undefined}
      footer={
        <>
          {error && <NoticeBox kind="error" text={error} />}
          <SetupButton label={t('common.continue')} onPress={next} busy={saving} disabled={!rules || !agreed} />
        </>
      }
    >
      <InfoCard index={1} icon="map-pin" title={t('setup.rules.timeinTitle')} text={t('setup.rules.timeinText')} />
      <InfoCard index={2} icon="navigation" title={t('setup.rules.locationTitle')} text={t('setup.rules.locationText')} />
      <InfoCard index={3} icon="users" title={t('setup.rules.whoTitle')} text={t('setup.rules.whoText')} />
      <InfoCard index={4} icon="smartphone" title={t('setup.rules.phoneTitle')} text={t('setup.rules.phoneText')} />
      <InfoCard index={5} icon="message-circle" title={t('setup.rules.aiTitle')} text={t('setup.rules.aiText')} />

      {loadError ? (
        <>
          <NoticeBox kind="error" text={t('setup.rules.loadFailed')} />
          <SetupButton kind="plain" label={t('setup.rules.retry')} onPress={load} />
        </>
      ) : (
        <Animated.View entering={arrive(5, reduced)}>
          <Card padded={false}>
            {!rules ? (
              <><SkeletonRow /><SkeletonRow /></>
            ) : (
              <>
                {terms && <ListRow icon="file-text" title={t('setup.rules.readTerms')} onPress={() => setReading(terms)} last={!privacy} />}
                {privacy && <ListRow icon="shield" title={t('setup.rules.readPrivacy')} onPress={() => setReading(privacy)} last />}
              </>
            )}
          </Card>
        </Animated.View>
      )}

      <Animated.View entering={arrive(6, reduced)}>
        <ChoiceCard
          title={t('setup.rules.agree')}
          selected={agreed}
          onPress={() => { setAgreed((a) => !a); setError(null); }}
        />
      </Animated.View>
      <View />

      <PolicyReaderModal visible={!!reading} policy={reading} isAcknowledged={false} readOnly onClose={() => setReading(null)} />
    </SetupFrame>
  );
}
