import React, { useState, useEffect, useMemo } from 'react';
import { useRouter as useExpoRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  SafeAreaView, 
  TextInput, 
  Alert, 
  ActivityIndicator, 
  Image 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/use-theme';
import PolicyReaderModal, { CompanyPolicy } from '../components/PolicyReaderModal';
import { formatMobileError } from '../lib/errorSanitizer';

const BRAND = {
  blue: '#1E3A8A',
  yellow: '#FBBF24',
  green: '#10B981',
  lightBg: '#F8FAFC'
};

export default function RootLoginScreen() {
  const router = useExpoRouter();
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [legalModalPolicy, setLegalModalPolicy] = useState<CompanyPolicy | null>(null);
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [loadingPolicy, setLoadingPolicy] = useState(false);

  const openPublicPolicy = async (policyId: 'terms_of_service' | 'privacy_policy') => {
    setLoadingPolicy(true);
    try {
      const { data, error } = await supabase
        .from('policies')
        .select('*')
        .eq('id', policyId)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) {
        Alert.alert('Notice', 'Policy document could not be loaded. Please ensure you are connected to the network.');
        return;
      }
      setLegalModalPolicy(data as CompanyPolicy);
      setLegalModalVisible(true);
    } catch (e) {
      Alert.alert('Notice', 'Unable to fetch policy at this time.');
    } finally {
      setLoadingPolicy(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/(tabs)');
        // Allow tabs to mount before dismissing splash screen
        setTimeout(() => {
          SplashScreen.hideAsync().catch(() => {});
        }, 120);
      } else {
        setLoading(false);
        SplashScreen.hideAsync().catch(() => {});
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace('/(tabs)');
        SplashScreen.hideAsync().catch(() => {});
      }
    });
    
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Sign in with a mobile number (09123456789 / +639123456789) or a username, plus the password from HR.
  const handleLogin = async () => {
    setLoginError(null);
    const input = identifier.trim();
    if (!input || !password) {
      setLoginError('Enter your mobile number or username, and your password.');
      return;
    }
    setLoading(true);

    try {
      let email = input.toLowerCase();
      const digits = input.replace(/\D/g, '');
      const looksLikePhone = /^[+\d\s-]+$/.test(input) && digits.length >= 10;

      if (looksLikePhone) {
        if (!/^(09\d{9}|639\d{9}|9\d{9})$/.test(digits)) {
          setLoginError('Enter an 11-digit mobile number, e.g. 09123456789.');
          setLoading(false);
          return;
        }
        const { data: found, error: rpcError } = await supabase.rpc('get_email_from_contact', { p_contact: input });
        if (rpcError || !found) {
          setLoginError('This number is not registered. Please contact HR.');
          setLoading(false);
          return;
        }
        email = found;
      } else if (!email.includes('@')) {
        email = `${email}@technocycle.ph`;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setLoginError(formatMobileError(error, 'Wrong mobile number, username or password.'));
        setLoading(false);
      }
    } catch (err) {
      setLoginError('Could not reach the server. Please check your connection.');
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <View style={styles.masterContainer}>
      <LinearGradient
        colors={isDark ? ['#0B0F17', '#131B26', '#0B0F17'] : ['#FFFFFF', '#F8FAFC', '#E2E8F0']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Image 
            source={require('../../assets/logo.png')} 
            style={styles.logo}
          />
          <Text style={styles.title}>TechnoCycle</Text>
          <Text style={styles.subtitle}>Field Service Operations</Text>

          <View style={styles.inputCard}>
            
            <Text style={styles.methodTitle}>Sign In</Text>
            {loginError && <Text style={{color: '#EF4444', marginBottom: 12, textAlign: 'center', fontFamily: 'DMSans-Medium'}}>{loginError}</Text>}
            <View style={styles.inputWrapper}>
              <Feather name="user" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Mobile number or username"
                placeholderTextColor={colors.textSubtle}
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Feather name="lock" size={20} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={colors.textSubtle}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                onSubmitEditing={handleLogin}
              />
            </View>

            <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} activeOpacity={0.8}>
              <Text style={styles.loginBtnText}>Sign In</Text>
            </TouchableOpacity>

          </View>

          {/* Legal Compliance Footer Links */}
          <View style={styles.legalFooter}>
            <Text style={[styles.legalText, { color: colors.textMuted }]}>
              By signing in, you agree to TechnoCycle's
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
              <TouchableOpacity onPress={() => openPublicPolicy('terms_of_service')} disabled={loadingPolicy}>
                <Text style={[styles.legalLink, { color: isDark ? colors.brandBlue : BRAND.blue }]}>Terms of Service</Text>
              </TouchableOpacity>
              <Text style={{ color: colors.textSubtle }}>•</Text>
              <TouchableOpacity onPress={() => openPublicPolicy('privacy_policy')} disabled={loadingPolicy}>
                <Text style={[styles.legalLink, { color: isDark ? colors.brandBlue : BRAND.blue }]}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>

      <PolicyReaderModal
        visible={legalModalVisible}
        policy={legalModalPolicy}
        isAcknowledged={false}
        readOnly={true}
        onClose={() => setLegalModalVisible(false)}
      />
    </View>
  );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  masterContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logo: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
    marginBottom: 24,
  },
  title: {
    fontFamily: 'DMSans-Bold',
    fontSize: 32,
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'DMSans-Medium',
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: 40,
  },
  inputCard: {
    backgroundColor: colors.card,
    width: '100%',
    padding: 24,
    borderRadius: 24,
    borderWidth: isDark ? 1 : 0,
    borderColor: colors.cardBorder,
    shadowColor: isDark ? '#000' : BRAND.blue,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: isDark ? 0.3 : 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  methodTitle: {
    fontFamily: 'DMSans-Bold',
    fontSize: 18,
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontFamily: 'DMSans-Regular',
    fontSize: 16,
    color: colors.text,
  },
  loginBtn: {
    backgroundColor: BRAND.blue,
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: BRAND.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginBtnText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 16,
    color: BRAND.yellow,
  },
  switchBtn: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchBtnText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 14,
    color: isDark ? colors.brandBlue : BRAND.blue,
  },
  legalFooter: {
    marginTop: 24,
    alignItems: 'center',
  },
  legalText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 12,
  },
  legalLink: {
    fontFamily: 'DMSans-Bold',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
});
