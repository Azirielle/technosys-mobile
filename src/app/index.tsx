// Sign-in page. Technicians see mobile number + PIN first; "Sign in with email instead" is below it.
// Nobody gets into the app until this phone is checked against their registered phone.
// After signing in, first-time setup (app/setup/) runs for whatever is still left on this phone.
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, type Href } from 'expo-router';
import Animated from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import {
  StyleSheet, Text, View, TouchableOpacity, Image, KeyboardAvoidingView, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { GlowScreen, Techy, arrive, useReducedMotion, useTokens, tokens, appAlert } from '../ui';
import PolicyReaderModal, { CompanyPolicy } from '../components/PolicyReaderModal';
import PhoneSignInForm from '../components/login/PhoneSignInForm';
import EmailSignInForm from '../components/login/EmailSignInForm';
import WelcomeBackForm from '../components/login/WelcomeBackForm';
import OtherPhoneNotice from '../components/login/OtherPhoneNotice';
import { checkThisPhone, signInWithPin, requestPhoneChangeAndSignOut } from '../lib/signIn';
import { loadPendingSteps, stepRoute } from '../lib/setup';
import { forget, getRemembered, type Remembered } from '../lib/quickSignIn';

type Screen =
  | { name: 'welcome'; who: Remembered }
  | { name: 'phone' }
  | { name: 'email' }
  | { name: 'other_phone'; via: 'pin'; mobile: string; pin: string }
  | { name: 'other_phone'; via: 'email' };

export default function SignInPage() {
  const router = useRouter();
  const { c } = useTokens();
  const reduced = useReducedMotion();
  const styles = useMemo(() => getStyles(c), [c]);
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
      } else {
        const who = await getRemembered(); // this phone's technician signed out before: PIN only
        if (who) setScreen({ name: 'welcome', who });
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
      appAlert('Not available', "Couldn't open this page. Check your signal and try again.");
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
      <View style={[styles.page, { alignItems: 'center' }]}>
        <Techy mood="wave" size={120} />
      </View>
    );
  }

  return (
    <GlowScreen>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" /* Android draws edge-to-edge and no longer resizes for the keyboard */>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Image source={require('../../assets/logo.png')} style={styles.logo} />
            <Text style={styles.title}>TechnoCycle</Text>
            <Text style={styles.subtitle}>Field Service Operations</Text>

            {/* Each form fades in and rises a little when you switch (motion #4) */}
            <Animated.View key={screen.name} entering={arrive(0, reduced)} style={{ width: '100%' }}>
            {screen.name === 'welcome' && (
              <WelcomeBackForm
                who={screen.who}
                onSignedIn={openApp}
                onOtherPhone={(mobile, pin) => setScreen({ name: 'other_phone', via: 'pin', mobile, pin })}
                onNotYou={async () => { await forget(); setScreen({ name: 'phone' }); }}
              />
            )}
            {screen.name === 'phone' && (
              <PhoneSignInForm
                onSignedIn={openApp}
                onOtherPhone={(mobile, pin) => setScreen({ name: 'other_phone', via: 'pin', mobile, pin })}
                onUseEmail={() => setScreen({ name: 'email' })}
              />
            )}
            {screen.name === 'email' && (
              <EmailSignInForm
                onSignedIn={openApp}
                onOtherPhone={() => setScreen({ name: 'other_phone', via: 'email' })}
                onUsePhone={() => setScreen({ name: 'phone' })}
              />
            )}
            {screen.name === 'other_phone' && (
              <OtherPhoneNotice onRequest={requestChange} onBack={backToSignIn} />
            )}
            </Animated.View>

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
              {__DEV__ && (
                <TouchableOpacity onPress={() => router.push('/ui-preview' as Href)} style={{ marginTop: 14 }}>
                  <Text style={styles.legalText}>UI preview (development only)</Text>
                </TouchableOpacity>
              )}
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
    </GlowScreen>
  );
}

const getStyles = (c: tokens.Palette) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: c.canvas, justifyContent: 'center' },
    content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 32 },
    logo: { width: 84, height: 84, resizeMode: 'contain', marginBottom: 14 },
    title: { ...tokens.type.display, color: c.ink, marginBottom: 2 },
    subtitle: { ...tokens.type.body, color: c.ink2, marginBottom: 26 },
    legal: { marginTop: 24, alignItems: 'center' },
    legalText: { ...tokens.type.caption, color: c.ink2 },
    legalLinks: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 },
    legalLink: { ...tokens.type.label, fontSize: 12, textDecorationLine: 'underline', color: c.brand },
  });
