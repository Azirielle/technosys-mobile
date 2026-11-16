// Setup step (technicians and helpers): make this phone their work phone, on purpose.
// If the account already has another phone, they can only ask HR to switch it.
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
import { useT } from '../../lib/i18n';
import { getDeviceName } from '../../lib/deviceId';
import { registerThisPhone, requestPhoneChangeAndSignOut } from '../../lib/signIn';
import { goAfter, stepNumber } from '../../lib/setup';
import { supabase } from '../../lib/supabase';
import SetupFrame from '../../components/setup/SetupFrame';
import SetupButton from '../../components/setup/SetupButton';
import NoticeBox from '../../components/setup/NoticeBox';
import OtherPhoneNotice from '../../components/login/OtherPhoneNotice';

export default function PhoneStep() {
  const router = useRouter();
  const t = useT();
  const { colors, isDark } = useAppTheme();
  const { step, total } = stepNumber('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otherPhone, setOtherPhone] = useState(false);

  const register = async () => {
    setBusy(true);
    setError(null);
    const result = await registerThisPhone();
    setBusy(false);
    if (result === 'ok') return goAfter(router, 'phone');
    if (result === 'other_phone') return setOtherPhone(true);
    setError(t('common.noSignal'));
  };

  // Someone registered another phone for this account first (rare): same choice as at sign-in.
  if (otherPhone) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <OtherPhoneNotice
          colors={colors}
          isDark={isDark}
          onRequest={requestPhoneChangeAndSignOut}
          onBack={async () => {
            await supabase.auth.signOut().catch(() => {});
            router.replace('/' as Href);
          }}
        />
      </View>
    );
  }

  const points = [t('setup.phone.point1'), t('setup.phone.point2'), t('setup.phone.point3')];

  return (
    <SetupFrame
      step={step}
      total={total}
      title={t('setup.phone.title')}
      subtitle={t('setup.phone.subtitle')}
      onBack={router.canGoBack() ? router.back : undefined}
      footer={
        <>
          {error && <NoticeBox kind="error" text={error} />}
          <SetupButton label={t('setup.phone.register')} onPress={register} busy={busy} />
        </>
      }
    >
      <View style={[styles.phoneCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={[styles.phoneIcon, { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : '#EFF6FF' }]}>
          <Feather name="smartphone" size={30} color={colors.brandBlue} />
        </View>
        <Text style={[styles.small, { color: colors.textMuted }]}>{t('setup.phone.thisPhone')}</Text>
        <Text style={[styles.model, { color: colors.text }]}>{getDeviceName()}</Text>
      </View>

      {points.map(p => (
        <View key={p} style={styles.point}>
          <Feather name="check" size={18} color="#059669" style={{ marginTop: 2 }} />
          <Text style={[styles.pointText, { color: colors.text }]}>{p}</Text>
        </View>
      ))}
    </SetupFrame>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: 24 },
  phoneCard: { alignItems: 'center', padding: 24, borderRadius: 20, borderWidth: 1, marginBottom: 8 },
  phoneIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  small: { fontFamily: 'DMSans-Medium', fontSize: 13 },
  model: { fontFamily: 'DMSans-Bold', fontSize: 20, marginTop: 2, textAlign: 'center' },
  point: { flexDirection: 'row', gap: 10 },
  pointText: { flex: 1, fontFamily: 'DMSans-Regular', fontSize: 15, lineHeight: 22 },
});
