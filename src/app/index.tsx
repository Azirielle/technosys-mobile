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
  const [loginMethod, setLoginMethod] = useState<'phone' | 'email'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('+639');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handlePhoneLogin = async () => {
    setLoginError(null);
    if (!phoneNumber || phoneNumber.length < 10) {
      setLoginError('Please enter a valid mobile number.');
      return;
    }
    setLoading(true);
    
    try {
      const { data: emailAttached, error: rpcError } = await supabase.rpc('get_email_from_contact', { p_contact: phoneNumber });
      
      if (rpcError || !emailAttached) {
         setLoginError('Number not found. Please contact HR.');
         setLoading(false);
         return;
      }
      
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: emailAttached,
        password: 'password123',
      });

      if (authError) {
        Alert.alert('Auth Error', 'Number found, but failed to generate session. (Check test passwords)');
        setLoading(false);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not verify number.');
      setLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    setLoginError(null);
    if (!email || !password) {
      setLoginError('Please enter both email and password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoginError(error.message);
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
            
            {loginMethod === 'phone' ? (
              <>
                <Text style={styles.methodTitle}>Mobile Access</Text>
                {loginError && <Text style={{color: '#EF4444', marginBottom: 12, textAlign: 'center', fontFamily: 'DMSans-Medium'}}>{loginError}</Text>}
                <View style={styles.inputWrapper}>
                  <Feather name="phone" size={20} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="+639..."
                    placeholderTextColor={colors.textSubtle}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                  />
                </View>

                <TouchableOpacity style={styles.loginBtn} onPress={handlePhoneLogin} activeOpacity={0.8}>
                  <Text style={styles.loginBtnText}>Sign In</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.switchBtn} onPress={() => setLoginMethod('email')}>
                  <Text style={styles.switchBtnText}>Log in with email instead</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.methodTitle}>Email Access</Text>
                {loginError && <Text style={{color: '#EF4444', marginBottom: 12, textAlign: 'center', fontFamily: 'DMSans-Medium'}}>{loginError}</Text>}
                <View style={styles.inputWrapper}>
                  <Feather name="mail" size={20} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Work Email"
                    placeholderTextColor={colors.textSubtle}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
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
                  />
                </View>

                <TouchableOpacity style={styles.loginBtn} onPress={handleEmailLogin} activeOpacity={0.8}>
                  <Text style={styles.loginBtnText}>Sign In</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.switchBtn} onPress={() => setLoginMethod('phone')}>
                  <Text style={styles.switchBtnText}>Log in with mobile number instead</Text>
                </TouchableOpacity>
              </>
            )}

          </View>
        </View>
      </SafeAreaView>
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
  }
});
