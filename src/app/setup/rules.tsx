// Setup step: the app rules in four plain points, links to the full Terms of use and Privacy
// notice, and "I agree". Agreeing records a signature for both (HR sees it in Policies).
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
import { useT } from '../../lib/i18n';
import { agreeToRules, goAfter, loadAppRules, stepNumber } from '../../lib/setup';
import SetupFrame from '../../components/setup/SetupFrame';
import SetupButton from '../../components/setup/SetupButton';
import InfoCard from '../../components/setup/InfoCard';
import NoticeBox from '../../components/setup/NoticeBox';
import PolicyReaderModal, { CompanyPolicy } from '../../components/PolicyReaderModal';

export default function RulesStep() {
  const router = useRouter();
  const t = useT();
  const { colors } = useAppTheme();
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
      <InfoCard icon="map-pin" tint="#2563EB" title={t('setup.rules.timeinTitle')} text={t('setup.rules.timeinText')} />
      <InfoCard icon="navigation" tint="#059669" title={t('setup.rules.locationTitle')} text={t('setup.rules.locationText')} />
      <InfoCard icon="users" tint="#7C3AED" title={t('setup.rules.whoTitle')} text={t('setup.rules.whoText')} />
      <InfoCard icon="message-circle" tint="#D97706" title={t('setup.rules.aiTitle')} text={t('setup.rules.aiText')} />

      {loadError ? (
        <>
          <NoticeBox kind="error" text={t('setup.rules.loadFailed')} />
          <SetupButton kind="plain" label={t('setup.rules.retry')} onPress={load} />
        </>
      ) : !rules ? (
        <ActivityIndicator color={colors.brandBlue} style={{ marginVertical: 8 }} />
      ) : (
        <View style={{ gap: 4 }}>
          {terms && <ReadLink label={t('setup.rules.readTerms')} onPress={() => setReading(terms)} color={colors.brandBlue} />}
          {privacy && <ReadLink label={t('setup.rules.readPrivacy')} onPress={() => setReading(privacy)} color={colors.brandBlue} />}
        </View>
      )}

      <TouchableOpacity
        onPress={() => { setAgreed(a => !a); setError(null); }}
        style={[styles.agree, { backgroundColor: colors.card, borderColor: agreed ? colors.brandBlue : colors.cardBorder }]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreed }}
        activeOpacity={0.8}
      >
        <View style={[styles.box, { borderColor: agreed ? colors.brandBlue : colors.textSubtle, backgroundColor: agreed ? colors.brandBlue : 'transparent' }]}>
          {agreed && <Feather name="check" size={16} color="#FFFFFF" />}
        </View>
        <Text style={[styles.agreeText, { color: colors.text }]}>{t('setup.rules.agree')}</Text>
      </TouchableOpacity>

      <PolicyReaderModal visible={!!reading} policy={reading} isAcknowledged={false} readOnly onClose={() => setReading(null)} />
    </SetupFrame>
  );
}

function ReadLink({ label, onPress, color }: { label: string; onPress: () => void; color: string }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.link} accessibilityRole="link">
      <Feather name="file-text" size={16} color={color} />
      <Text style={[styles.linkText, { color }]}>{label}</Text>
      <Feather name="chevron-right" size={16} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  linkText: { flex: 1, fontFamily: 'DMSans-Bold', fontSize: 14 },
  agree: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: 2, marginTop: 4 },
  box: { width: 26, height: 26, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  agreeText: { flex: 1, fontFamily: 'DMSans-Bold', fontSize: 15 },
});
