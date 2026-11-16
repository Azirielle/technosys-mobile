// Sign-in page. Technicians see mobile number + PIN first; "Sign in with email instead" is below it.
// Nobody gets into the app until this phone is checked against their registered phone.
// After signing in, first-time setup (app/setup/) runs for whatever is still left on this phone.
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import {
  StyleSheet, Text, View, TouchableOpacity, Alert, Image, KeyboardAvoidingView, ScrollView, Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAppTheme } from '../hooks/use-theme';
import PolicyReaderModal, { CompanyPolicy } from '../components/PolicyReaderModal';
import PhoneSignInForm from '../components/login/PhoneSignInForm';
import EmailSignInForm from '../components/login/EmailSignInForm';
import OtherPhoneNotice from '../components/login/OtherPhoneNotice';
import { checkThisPhone, signInWithPin, requestPhoneChangeAndSignOut } from '../lib/signIn';
import { loadPendingSteps, stepRoute } from '../lib/setup';

type Screen =
  | { name: 'phone' }
  | { name: 'email' }
  | { name: 'other_phone'; via: 'pin'; mobile: string; pin: string }
  | { name: 'other_phone'; via: 'email' };

export default function SignInPage() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [checkingSession, setCheckingSession] = useState(true);
  const [screen, setScreen] = useState<Screen>({ name: 'phone' });
  const [legalPolicy, setLegalPolicy] = useState<CompanyPolicy | null>(null);
  const [opening, setOpening] = useState(false);

  // Signed in on the right phone: finish whatever setup is left, then open the app.
  const openApp = async () => {
    setOpening(true);
    const steps = await loadPendingSteps().catch(() => []);
    router.replace(steps.length ? stepRoute(steps[0]) : ('/(tabs)' as Href));
    setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 120);
  };

  // Already signed in on this phone: check it's still the registered phone (it may have been switched by HR).
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const phone = await checkThisPhone();
        if (phone !== 'other_phone') return openApp();
        setScreen({ name: 'other_phone', via: 'email' }); // keeps the session so they can ask HR
      }
      setCheckingSession(false);
      SplashScreen.hideAsync().catch(() => {});
    })();
  }, []);

  const openPublicPolicy = async (policyId: 'terms_of_service' | 'privacy_policy') => {
    try {
      // Newest active version (ids change with each version, e.g. terms_of_service_rev_v1_1)
      const { data, error } = await supabase
        .from('policies')
        .select('*')
        .like('id', `${policyId}%`)
        .eq('is_active', true)
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) throw new Error('not found');
      setLegalPolicy(data as CompanyPolicy);
    } catch {
      Alert.alert('Not available', "Couldn't open this page. Check your signal and try again.");
    }
  };

  const backToSignIn = async () => {
    if (screen.name === 'other_phone' && screen.via === 'email') await supabase.auth.signOut().catch(() => {});
    setScreen({ name: 'phone' });
  };

  const requestChange = async (): Promise<boolean> => {
    if (screen.name !== 'other_phone') return false;
    if (screen.via === 'email') return requestPhoneChangeAndSignOut();
    const result = await signInWithPin(screen.mobile, screen.pin, true);
    return !result.ok && result.reason === 'change_requested';
  };

  if (checkingSession) return null;
  if (opening) {
    return (
      <View style={[styles.page, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.brandBlue} />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <LinearGradient
        colors={isDark ? ['#0B0F17', '#131B26', '#0B0F17'] : ['#FFFFFF', '#F8FAFC', '#E2E8F0']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Image source={require('../../assets/logo.png')} style={styles.logo} />
            <Text style={styles.title}>TechnoCycle</Text>
            <Text style={styles.subtitle}>Field Service Operations</Text>

            {screen.name === 'phone' && (
              <PhoneSignInForm
                colors={colors}
                isDark={isDark}
                onSignedIn={openApp}
                onOtherPhone={(mobile, pin) => setScreen({ name: 'other_phone', via: 'pin', mobile, pin })}
                onUseEmail={() => setScreen({ name: 'email' })}
              />
            )}
            {screen.name === 'email' && (
              <EmailSignInForm
                colors={colors}
                isDark={isDark}
                onSignedIn={openApp}
                onOtherPhone={() => setScreen({ name: 'other_phone', via: 'email' })}
                onUsePhone={() => setScreen({ name: 'phone' })}
              />
            )}
            {screen.name === 'other_phone' && (
              <OtherPhoneNotice colors={colors} isDark={isDark} onRequest={requestChange} onBack={backToSignIn} />
            )}

            <View style={styles.legal}>
              <View style={styles.legalLinks}>
                <TouchableOpacity onPress={() => openPublicPolicy('terms_of_service')}>
                  <Text style={styles.legalLink}>Terms of Service</Text>
                </TouchableOpacity>
                <Text style={styles.legalText}>•</Text>
                <TouchableOpacity onPress={() => openPublicPolicy('privacy_policy')}>
                  <Text style={styles.legalLink}>Privacy Policy</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <PolicyReaderModal
        visible={!!legalPolicy}
        policy={legalPolicy}
        isAcknowledged={false}
        readOnly
        onClose={() => setLegalPolicy(null)}
      />
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.bg },
    content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 32 },
    logo: { width: 88, height: 88, resizeMode: 'contain', marginBottom: 16 },
    title: { fontFamily: 'DMSans-Bold', fontSize: 30, color: colors.text, marginBottom: 4 },
    subtitle: { fontFamily: 'DMSans-Medium', fontSize: 15, color: colors.textMuted, marginBottom: 28 },
    legal: { marginTop: 24, alignItems: 'center' },
    legalText: { fontFamily: 'DMSans-Regular', fontSize: 12, color: colors.textMuted },
    legalLinks: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 },
    legalLink: { fontFamily: 'DMSans-Bold', fontSize: 12, textDecorationLine: 'underline', color: colors.brandBlue },
  });
