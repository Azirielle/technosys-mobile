import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Alert } from 'react-native';
import { useRouter as useExpoRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

// TECHONOSYS PRO BRAND COLORS
const BRAND = {
  blue: '#1E3A8A',    
  yellow: '#FBBF24',  
  green: '#10B981',   
  red: '#EF4444',     
  lightBg: '#F8FAFC',
};

export default function LoginScreen() {
  const router = useExpoRouter();
  const [loginMethod, setLoginMethod] = useState<'phone' | 'email'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('+639');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/(tabs)' as any);
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace('/(tabs)' as any);
      }
    });
    
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handlePhoneLogin = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      Alert.alert('Error', 'Please enter a valid mobile number.');
      return;
    }
    setLoading(true);
    
    // TEMPORARY MOCK FOR PHONE LOGIN:
    // Because we need a real Supabase session for RLS to work, but we don't have SMS OTP yet,
    // we use an RPC to find the email attached to this phone, then use a default password.
    try {
      const { data: emailAttached, error: rpcError } = await supabase.rpc('get_email_from_contact', { p_contact: phoneNumber });
      
      if (rpcError || !emailAttached) {
         Alert.alert('Access Denied', 'Number not found in the database. Please contact HR.');
         setLoading(false);
         return;
      }
      
      // Attempt login with a universal default password for testing phase
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: emailAttached,
        password: 'password123', // Assumption for testing
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
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      Alert.alert('Login Failed', error.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BRAND.blue} />
      </View>
    );
  }

  return (
    <View style={styles.masterContainer}>
      <LinearGradient
        colors={['#FFFFFF', '#F8FAFC', '#E2E8F0']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Image 
            source={require('../../assets/logo.png')} 
            style={styles.logo}
          />
          <Text style={styles.title}>TechnoSys Pro</Text>
          <Text style={styles.subtitle}>Technician Action Kiosk</Text>

          <View style={styles.inputCard}>
            
            {loginMethod === 'phone' ? (
              <>
                <Text style={styles.methodTitle}>Mobile Access</Text>
                <View style={styles.inputWrapper}>
                  <Feather name="phone" size={20} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="+639..."
                    placeholderTextColor="#94A3B8"
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
                <View style={styles.inputWrapper}>
                  <Feather name="mail" size={20} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Work Email"
                    placeholderTextColor="#94A3B8"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <Feather name="lock" size={20} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#94A3B8"
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

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  masterContainer: {
    flex: 1,
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
    color: '#0F172A',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'DMSans-Medium',
    fontSize: 16,
    color: '#64748B',
    marginBottom: 40,
  },
  inputCard: {
    backgroundColor: '#fff',
    width: '100%',
    padding: 24,
    borderRadius: 24,
    shadowColor: BRAND.blue,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  methodTitle: {
    fontFamily: 'DMSans-Bold',
    fontSize: 18,
    color: '#0F172A',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
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
    color: '#0F172A',
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
    color: BRAND.blue,
  }
});

