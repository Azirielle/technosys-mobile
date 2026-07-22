import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, StatusBar, TextInput, Alert, ActivityIndicator, Image, Animated, Platform, ViewStyle, TextStyle, Linking, useWindowDimensions, Modal, Keyboard, BackHandler, Switch } from 'react-native';
import { supabase } from '../lib/supabase';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { CopilotProvider, CopilotStep, walkthroughable, useCopilot } from 'react-native-copilot';

const CopilotView = walkthroughable(View);
const CopilotTouchableOpacity = walkthroughable(TouchableOpacity);


// Global custom alert types & polyfill
interface CustomAlertPayload {
  title: string;
  message?: string;
  buttons?: Array<{
    text?: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>;
  rawMessage?: string;
}

let activeAppLanguage: 'en' | 'fil' | 'ja' = 'en';

const sanitizeErrorMessage = (title: string, message: string, lang: 'en' | 'fil' | 'ja') => {
  const text = `${title} ${message}`.toLowerCase();
  
  // Connection / DNS errors
  if (
    text.includes('unknownhostexception') || 
    text.includes('fetch failed') || 
    text.includes('network request failed') ||
    text.includes('unable to resolve host') ||
    text.includes('network error')
  ) {
    if (lang === 'ja') return '接続エラーが発生しました。インターネット接続を確認し、再試行してください。';
    return lang === 'fil'
      ? 'Problema sa Koneksyon. Pakisuri ang iyong internet connection at subukan muli.'
      : 'Connection Error. Please check your internet connection and try again.';
  }

  // Auth invalid credentials
  if (
    text.includes('invalid_credentials') || 
    text.includes('invalid claim') || 
    text.includes('invalid email or password') ||
    text.includes('maling email o password')
  ) {
    if (lang === 'ja') return 'メールアドレスまたはパスワードが正しくありません。再試行してください。';
    return lang === 'fil'
      ? 'Maling email o password. Pakisubukan muli.'
      : 'Invalid email or password. Please try again.';
  }

  // Database unique key constraint
  if (
    text.includes('duplicate key value') || 
    text.includes('violates unique constraint') || 
    text.includes('already exists')
  ) {
    if (lang === 'ja') return 'このレコードは既にシステムに存在します。';
    return lang === 'fil'
      ? 'Ang impormasyong ito ay mayroon na sa system.'
      : 'This record already exists in the system.';
  }

  // Row Level Security (RLS) policies
  if (
    text.includes('row level security') || 
    text.includes('violates row-level security') || 
    text.includes('violates rls')
  ) {
    if (lang === 'ja') return 'アクセスが拒否されました。この項目を変更する権限がありません。';
    return lang === 'fil'
      ? 'Access Denied. Wala kang pahintulot na baguhin ang item na ito.'
      : 'Access Denied. You do not have permission to modify this item.';
  }

  // Database foreign key constraint
  if (
    text.includes('violates foreign key constraint') ||
    text.includes('foreign key violation')
  ) {
    if (lang === 'ja') return '処理を完了できませんでした。関連するレコードが見つかりません。';
    return lang === 'fil'
      ? 'Hindi makumpleto ang operasyon. Nawawala ang kaugnay na record.'
      : 'Operation failed. Associated record was not found.';
  }

  // JWT expired
  if (
    text.includes('jwt expired') || 
    text.includes('session expired') || 
    text.includes('invalid ticket')
  ) {
    if (lang === 'ja') return 'セッションの有効期限が切れました。再度ログインしてください。';
    return lang === 'fil'
      ? 'Nawalan ng bisa ang iyong session. Pakilog-in muli.'
      : 'Your session has expired. Please log in again.';
  }

  // Supabase storage bucket errors
  if (
    text.includes('bucket not found') ||
    text.includes('storage bucket')
  ) {
    if (lang === 'ja') return 'ファイルストレージエラーが発生しました。サポートにお問い合わせください。';
    return lang === 'fil'
      ? 'Problema sa imbakan ng file. Mangyaring kontakin ang suporta.'
      : 'File system storage error. Please contact support.';
  }

  // Location timeout
  if (
    text.includes('location timeout') ||
    (text.includes('timed out') && text.includes('location'))
  ) {
    if (lang === 'ja') return '位置情報の取得がタイムアウトしました。GPS設定を確認して再試行してください。';
    return lang === 'fil'
      ? 'Hindi makuha ang iyong lokasyon. Pakisubukan muli sa labas o buksan ang GPS.'
      : 'Location verification timeout. Please verify your GPS settings and try again.';
  }

  return message;
};

const nativeAlert = Alert.alert;
let globalAlertTrigger: ((payload: CustomAlertPayload) => void) | null = null;
const alertQueue: CustomAlertPayload[] = [];

Alert.alert = (title: string, message?: string, buttons?: any[]) => {
  const raw = message || '';
  const sanitized = sanitizeErrorMessage(title, raw, activeAppLanguage);
  
  const payload = { 
    title, 
    message: sanitized, 
    buttons,
    rawMessage: raw !== sanitized ? raw : undefined 
  };

  // Auto-dismiss keyboard when alerts launch
  Keyboard.dismiss();

  if (globalAlertTrigger) {
    globalAlertTrigger(payload);
  } else {
    // If React UI isn't ready, store it in queue
    alertQueue.push(payload);
  }
};
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useGeofence } from '../hooks/useGeofence';
import GeofenceMobileMap from '../components/GeofenceMobileMap';
import HybridCamera from '../components/HybridCamera';
import { TicketsTab } from '../components/TicketsTab';
import SchedulesTab from '../components/SchedulesTab';
import { syncQueue } from '../lib/syncQueue';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { withTimeout } from '../lib/timeout';
import { Locale, TRANSLATIONS } from '../lib/translations';
import * as SecureStore from 'expo-secure-store';
// Local phone biometrics disabled per strict policy (wall terminal validation only)
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as TaskManager from 'expo-task-manager';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false, // soft default
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const BACKGROUND_LOCATION_TASK = 'BACKGROUND_GEOLOCATION_TRACKING';

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error("Background location task error:", error);
    return;
  }
  if (data) {
    const { locations } = data;
    if (locations && locations.length > 0) {
      const location = locations[0];
      const { latitude, longitude, accuracy } = location.coords;
      try {
        const activeUserId = await AsyncStorage.getItem('ACTIVE_USER_ID');
        if (activeUserId) {
          const { error: dbErr } = await supabase
            .from('live_locations')
            .insert({
              technician_id: activeUserId,
              latitude,
              longitude,
              gps_accuracy: accuracy
            });
          if (dbErr) {
            console.error("Failed to insert live location:", dbErr.message);
          }
        }
      } catch (err) {
        console.error("Error in background location task execution:", err);
      }
    }
  }
});

async function registerForPushNotificationsAsync(userId: string) {
  if (Platform.OS === 'web') {
    console.log('Push notifications not supported on web platform.');
    return;
  }
  if (!Device.isDevice) {
    console.log('Must use physical device for Push Notifications');
    return;
  }
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    // Fetch token
    const projectId = require('../../app.json')?.expo?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn('Expo Project ID not found in app.json. Cannot fetch push token.');
      return;
    }
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId
    });
    const token = tokenData.data;
    console.log('Expo Push Token generated successfully:', token);
    
    // Save to Supabase profiles table
    const { error } = await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', userId);
      
    if (error) {
      console.error('Failed to update push token in profile:', error.message);
    }
  } catch (e: any) {
    console.warn('Error in push registration:', e.message || e);
  }
}

// Clean White Professional Theme
let COLORS = {
  background: '#ffffff',
  card: '#f8fafc',
  primary: '#10b981',
  primaryDim: 'rgba(16, 185, 129, 0.1)',
  textMain: '#0f172a',
  textMuted: '#64748b',
  danger: '#ef4444',
  border: '#e2e8f0',
  whiteCard: '#ffffff',
  isDarkMode: false
};

const FadeInView = ({ children, currentTab }: any) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(8)).current;

  React.useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(8);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      })
    ]).start();
  }, [currentTab]);

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      {children}
    </Animated.View>
  );
};

const LoginScreen = ({ onLogin }: any) => {
  const styles = getStyles(COLORS);
  const [loginMethod, setLoginMethod] = useState<'phone'|'email'>('phone');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  React.useEffect(() => {
    let timer: any;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendOtp = async () => {
    if (!phone || phone.length !== 10) {
      setErrorMsg("Please enter a valid 10-digit number");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    const { error } = await supabase.auth.signInWithOtp({ phone: '+63' + phone });
    if (error) {
      if (error.message.toLowerCase().includes('unsupported phone provider') || error.message.toLowerCase().includes('sms provider')) {
        setErrorMsg("SMS login is currently disabled by the administrator. Please contact support or use a test account.");
      } else {
        setErrorMsg(error.message);
      }
    } else {
      setOtpSent(true);
      setCooldown(60);
    }
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      setErrorMsg("Please enter the 6-digit OTP");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    const { data, error } = await supabase.auth.verifyOtp({ phone: '+63' + phone, token: otp, type: 'sms' });
    if (error) {
      setErrorMsg(error.message);
    } else {
      onLogin(data.session);
    }
    setLoading(false);
  };

  const handleEmailLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErrorMsg(error.message);
    } else {
      onLogin(data.session);
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, { justifyContent: 'center', padding: 20 }]}>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Image source={require('../../assets/technocycle_logo.png')} style={{ width: 90, height: 90, resizeMode: 'contain', marginBottom: 8 }} />
          <Text style={{ color: COLORS.primary, fontSize: 15, fontWeight: '600', letterSpacing: 2 }}>EMPLOYEE PORTAL</Text>
        </View>
        
        <View style={{ backgroundColor: COLORS.card, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 }}>
          {errorMsg && (
            <View style={{
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              borderColor: COLORS.danger,
              borderWidth: 1,
              borderRadius: 12,
              padding: 12,
              marginBottom: 16,
              flexDirection: 'row',
              alignItems: 'center'
            }}>
              <Feather name="alert-triangle" size={16} color={COLORS.danger} style={{ marginRight: 8 }} />
              <Text style={{ color: COLORS.danger, fontSize: 13, fontWeight: 'bold', flex: 1 }}>
                {errorMsg}
              </Text>
            </View>
          )}

          {loginMethod === 'phone' ? (
            <View>
              <Text style={{ color: COLORS.textMain, marginBottom: 8, fontWeight: 'bold', fontSize: 13, textTransform: 'uppercase' }}>Phone Number</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: otpSent ? 16 : 24, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, backgroundColor: '#fff', overflow: 'hidden' }}>
                <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 16, height: 50, justifyContent: 'center', borderRightWidth: 1, borderRightColor: COLORS.border }}>
                  <Text style={{ fontWeight: 'bold', color: COLORS.textMuted }}>+63</Text>
                </View>
                <TextInput 
                  style={{ flex: 1, height: 50, paddingHorizontal: 16, fontSize: 16, color: COLORS.textMain, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}
                  placeholder="9171234567"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="number-pad"
                  maxLength={10}
                  editable={!otpSent}
                  value={phone}
                  onChangeText={(text) => setPhone(text.replace(/^0/, '').replace(/\D/g, ''))}
                />
              </View>

              {otpSent && (
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ color: COLORS.textMain, marginBottom: 8, fontWeight: 'bold', fontSize: 13, textTransform: 'uppercase' }}>6-Digit OTP</Text>
                  <TextInput 
                    style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, backgroundColor: '#fff', height: 50, paddingHorizontal: 16, fontSize: 20, color: COLORS.textMain, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 8, textAlign: 'center' }}
                    placeholder="123456"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otp}
                    onChangeText={(text) => setOtp(text.replace(/\D/g, ''))}
                  />
                </View>
              )}

              <TouchableOpacity 
                style={{ backgroundColor: (cooldown > 0 && !otpSent) ? '#94a3b8' : COLORS.primary, padding: 14, borderRadius: 12, alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 }}
                onPress={otpSent ? handleVerifyOtp : handleSendOtp}
                disabled={loading || (cooldown > 0 && !otpSent)}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 17 }}>{otpSent ? 'Verify OTP & Login' : cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Send OTP'}</Text>}
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => { setLoginMethod('email'); setErrorMsg(null); }} style={{ marginTop: 24, alignItems: 'center', padding: 8 }}>
                <Text style={{ color: COLORS.textMuted, fontSize: 13, fontWeight: '600' }}>Didn't receive SMS? Use Email instead</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text style={{ color: COLORS.textMain, marginBottom: 8, fontWeight: 'bold', fontSize: 13, textTransform: 'uppercase' }}>Email Address</Text>
              <TextInput 
                style={styles.input}
                placeholder="employee@technocycle.com"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />

              <Text style={{ color: COLORS.textMain, marginBottom: 8, fontWeight: 'bold', fontSize: 13, textTransform: 'uppercase' }}>Password</Text>
              <TextInput 
                style={[styles.input, { marginBottom: 24 }]}
                placeholder="••••••••"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              <TouchableOpacity 
                style={{ backgroundColor: COLORS.primary, padding: 14, borderRadius: 12, alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 }}
                onPress={handleEmailLogin}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 17 }}>Secure Login</Text>}
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => { setLoginMethod('phone'); setErrorMsg(null); }} style={{ marginTop: 24, alignItems: 'center', padding: 8 }}>
                <Text style={{ color: COLORS.primary, fontSize: 13, fontWeight: '600' }}>Back to Phone Login</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const getCountdownText = (sched: any) => {
  if (!sched || sched.attendance_mode !== 'out_of_town' || !sched.end_time) return null;
  const start = new Date(sched.start_time);
  start.setHours(0, 0, 0, 0);
  const end = new Date(sched.end_time);
  end.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const msPerDay = 24 * 60 * 60 * 1000;
  
  const totalDays = Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;
  const elapsedDays = Math.round((today.getTime() - start.getTime()) / msPerDay) + 1;
  const daysLeft = totalDays - elapsedDays;
  
  const displayElapsed = Math.max(1, Math.min(elapsedDays, totalDays));
  const displayDaysLeft = Math.max(0, daysLeft);
  
  return {
    totalDays,
    elapsedDays: displayElapsed,
    daysLeft: displayDaysLeft
  };
};

const openDirections = (location: string) => {
  if (!location) return;
  const encodedLocation = encodeURIComponent(location);
  const url = Platform.select({
    ios: `maps://app?daddr=${encodedLocation}`,
    android: `google.navigation:q=${encodedLocation}`,
    default: `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`
  });
  Linking.canOpenURL(url).then(supported => {
    if (supported) {
      Linking.openURL(url);
    } else {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedLocation}`);
    }
  }).catch(() => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedLocation}`);
  });
};

interface ActiveShiftTimerProps {
  startTime: string;
}

function ActiveShiftTimer({ startTime }: ActiveShiftTimerProps) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const calculateElapsed = () => {
      const startMs = new Date(startTime).getTime();
      const nowMs = Date.now();
      const diffMs = Math.max(0, nowMs - startMs);
      const totalSecs = Math.floor(diffMs / 1000);
      const hrs = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;
      return [
        hrs.toString().padStart(2, '0'),
        mins.toString().padStart(2, '0'),
        secs.toString().padStart(2, '0')
      ].join(':');
    };

    setElapsed(calculateElapsed());

    const timer = setInterval(() => {
      setElapsed(calculateElapsed());
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime]);

  return (
    <Text style={{ fontSize: 32, fontWeight: '800', color: COLORS.primary, marginVertical: 8 }}>
      {elapsed}
    </Text>
  );
}

export default function App() {
  return (
    <CopilotProvider stopOnOutsideClick androidStatusBarVisible>
      <MainAppContent />
    </CopilotProvider>
  );
}

function MainAppContent() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { start: startCopilot, copilotEvents } = useCopilot();
  const pushNotificationState = usePushNotifications();

  useEffect(() => {
    const loadTheme = async () => {
      const mode = await AsyncStorage.getItem('THEME_MODE');
      if (mode === 'dark') {
        setIsDarkMode(true);
      }
    };
    loadTheme();
  }, []);

  if (isDarkMode) {
    COLORS.background = '#0f172a';
    COLORS.card = '#1e293b';
    COLORS.whiteCard = '#1e293b';
    COLORS.primaryDim = 'rgba(16, 185, 129, 0.15)';
    COLORS.textMain = '#f8fafc';
    COLORS.textMuted = '#94a3b8';
    COLORS.border = '#334155';
    COLORS.isDarkMode = true;
  } else {
    COLORS.background = '#ffffff';
    COLORS.card = '#f8fafc';
    COLORS.whiteCard = '#ffffff';
    COLORS.primaryDim = 'rgba(16, 185, 129, 0.1)';
    COLORS.textMain = '#0f172a';
    COLORS.textMuted = '#64748b';
    COLORS.border = '#e2e8f0';
    COLORS.isDarkMode = false;
  }

  const styles = getStyles(COLORS);
  const { width } = useWindowDimensions();
  const [session, setSession] = useState<any>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Global custom alert states
  const [activeAlert, setActiveAlert] = useState<CustomAlertPayload | null>(null);
  const [alertQueueState, setAlertQueueState] = useState<CustomAlertPayload[]>([]);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  useEffect(() => {
    const showNextAlert = (nextAlert: CustomAlertPayload) => {
      setActiveAlert(nextAlert);
    };

    globalAlertTrigger = (payload: CustomAlertPayload) => {
      setAlertQueueState(prev => {
        const newQueue = [...prev, payload];
        if (newQueue.length === 1 && !activeAlert) {
          showNextAlert(payload);
        }
        return newQueue;
      });
    };

    // If alerts triggered before render, ingest them
    if (alertQueue.length > 0) {
      const initialQueue = [...alertQueue];
      alertQueue.length = 0;
      setAlertQueueState(initialQueue);
      showNextAlert(initialQueue[0]);
    }

    return () => {
      globalAlertTrigger = null;
    };
  }, [activeAlert]);

  const handleAlertDismiss = (buttonPressHandler?: () => void) => {
    if (buttonPressHandler) {
      try {
        buttonPressHandler();
      } catch (err) {
        console.error("Alert handler failed:", err);
      }
    }
    setActiveAlert(null);
    setShowErrorDetails(false); // Reset toggle state
    setAlertQueueState(prev => {
      const nextQueue = prev.slice(1);
      if (nextQueue.length > 0) {
        setTimeout(() => {
          setActiveAlert(nextQueue[0]);
        }, 150);
      }
      return nextQueue;
    });
  };

  const getAlertIconAndColor = (title: string, message: string) => {
    const text = `${title} ${message}`.toLowerCase();
    if (
      text.includes('success') || 
      text.includes('synced') || 
      text.includes('successful') || 
      text.includes('matagumpay') ||
      text.includes('completed')
    ) {
      return { icon: 'check-circle' as const, color: '#10b981' }; // Green
    }
    if (
      text.includes('failed') || 
      text.includes('error') || 
      text.includes('timeout') || 
      text.includes('timed out') || 
      text.includes('invalid') || 
      text.includes('bigo') || 
      text.includes('wrong') || 
      text.includes('incorrect')
    ) {
      return { icon: 'alert-circle' as const, color: '#ef4444' }; // Red
    }
    if (
      text.includes('location') || 
      text.includes('gps') || 
      text.includes('geofence') || 
      text.includes('proximity') || 
      text.includes('map')
    ) {
      return { icon: 'map-pin' as const, color: '#3b82f6' }; // Blue
    }
    return { icon: 'info' as const, color: '#3b82f6' }; // Info Blue
  };

  // Helper functions for platform-agnostic Secure Storage
  const getSecureItem = async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        return AsyncStorage.getItem(key);
      }
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      console.warn("SecureStore get failed", e);
      return null;
    }
  };

  const setSecureItem = async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(key, value);
      } else {
        await SecureStore.setItemAsync(key, value);
      }
    } catch (e) {
      console.warn("SecureStore set failed", e);
    }
  };

  const deleteSecureItem = async (key: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.removeItem(key);
      } else {
        await SecureStore.deleteItemAsync(key);
      }
    } catch (e) {
      console.warn("SecureStore delete failed", e);
    }
  };

  // Helper to verify server connectivity
  const checkIsOnline = async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      return typeof navigator !== 'undefined' ? navigator.onLine : true;
    }
    try {
      const response = await withTimeout(
        fetch('https://ggknkdyuglzcnkwhvdak.supabase.co'),
        2000
      );
      return !!response;
    } catch (e) {
      return false;
    }
  };

  const authenticateBiometrics = async (): Promise<boolean> => {
    // Strict Policy: Local phone biometrics disabled. Use physical biometric terminal instead.
    return true;
  };
  const [profile, setProfile] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [payslip, setPayslip] = useState<any>(null);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [searchPayslip, setSearchPayslip] = useState('');
  const [showPayslipHistory, setShowPayslipHistory] = useState(false);
  const [leaveAlert, setLeaveAlert] = useState<any>(null);
  const [timeInLoading, setTimeInLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [showLeavesModal, setShowLeavesModal] = useState(false);
  const [showApplyLeaveModal, setShowApplyLeaveModal] = useState(false);
  const [leavesLoading, setLeavesLoading] = useState(false);

  const [leaveType, setLeaveType] = useState<'sick' | 'vacation' | 'emergency' | 'unpaid'>('vacation');
  const [leaveStartDate, setLeaveStartDate] = useState('');
  const [leaveEndDate, setLeaveEndDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveAttachment, setLeaveAttachment] = useState<any>(null);
  const [leaveSubmitLoading, setLeaveSubmitLoading] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [showPayslipDetailsModal, setShowPayslipDetailsModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeAttachment, setDisputeAttachment] = useState<any>(null);
  const [disputeSubmitLoading, setDisputeSubmitLoading] = useState(false);
  const [timeOutLoading, setTimeOutLoading] = useState(false);
  const [activeTimeLog, setActiveTimeLog] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any | null>(null);
  const [showOtModal, setShowOtModal] = useState(false);
  const [otHours, setOtHours] = useState("1");
  const [otReason, setOtReason] = useState("");
  const [otSubmitting, setOtSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'schedules' | 'payslip' | 'profile' | 'tickets'>('home');
  const geofence = useGeofence();
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);

  // Intercept physical back button to close modals / redirect tabs
  useEffect(() => {
    const onBackPress = () => {
      // 0. Close announcement detail modal
      if (selectedAnnouncement) {
        setSelectedAnnouncement(null);
        return true;
      }
      
      // 1. Close leaves forms
      if (showApplyLeaveModal) {
        setShowApplyLeaveModal(false);
        return true;
      }
      if (showLeavesModal) {
        setShowLeavesModal(false);
        return true;
      }
      
      // 2. Close overtime request modal
      if (showOtModal) {
        setShowOtModal(false);
        return true;
      }

      // 3. Close payroll dispute modal if open
      if (showPayslipDetailsModal) {
        setShowPayslipDetailsModal(false);
        return true;
      }
      if (showDisputeModal) {
        setShowDisputeModal(false);
        return true;
      }

      // 4. Switch back to home tab before exiting
      if (activeTab !== 'home') {
        setActiveTab('home');
        return true;
      }

      return false; // Exit app
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => {
      subscription.remove();
    };
  }, [showLeavesModal, showApplyLeaveModal, showOtModal, showPayslipDetailsModal, showDisputeModal, activeTab, selectedAnnouncement]);

  // Phase 8: Two-Factor Biometric Scan States & Refs
  const [isWaitingForScan, setIsWaitingForScan] = useState(false);
  const [isCameraMode, setIsCameraMode] = useState(false);
  const [scanType, setScanType] = useState<'in' | 'out' | null>(null);
  const [scanCountdown, setScanCountdown] = useState(180);
  const scanTypeRef = React.useRef<'in' | 'out' | null>(null);
  const pendingLocationRef = React.useRef<any>(null);

  // Phase 8: DMS Download States
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  // Easter egg: logo tap counter
  const logoTapTimeout = React.useRef<any>(null);
  const [logoTaps, setLogoTaps] = useState(0);
  const [prevLang, setPrevLang] = useState<Locale>('en');

  const handleLogoTap = () => {
    if (logoTapTimeout.current) clearTimeout(logoTapTimeout.current);
    
    setLogoTaps(prev => {
      const next = prev + 1;
      if (next === 3) {
        if (language === 'ja') {
          setLanguage(prevLang);
          AsyncStorage.setItem('APP_LANGUAGE', prevLang);
          Alert.alert('Easter Egg Deactivated', 'Nihongo mode off! Returning to your previous language.');
        } else {
          setPrevLang(language);
          setLanguage('ja');
          AsyncStorage.setItem('APP_LANGUAGE', 'ja');
          Alert.alert('Easter Egg Activated!', 'ようこそ (Yokoso) to TechnoSys! Nihongo mode is now active.');
        }
        return 0;
      }
      
      logoTapTimeout.current = setTimeout(() => {
        setLogoTaps(0);
      }, 1500); // Reset after 1.5 seconds of inactivity
      
      return next;
    });
  };

  const [downloadProgress, setDownloadProgress] = useState(0);

  // Animations for new premium DTR states
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const breathingAnim = React.useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (isWaitingForScan) {
      pulseAnim.setValue(1);
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (loop) loop.stop();
    };
  }, [isWaitingForScan]);

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (activeTimeLog && !activeTimeLog.app_time_out) {
      breathingAnim.setValue(0.4);
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(breathingAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(breathingAnim, {
            toValue: 0.4,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
    } else {
      breathingAnim.setValue(0.4);
    }
    return () => {
      if (loop) loop.stop();
    };
  }, [activeTimeLog]);

  const startFormDownload = async (filename: string) => {
    if (downloadingFile) return;
    setDownloadingFile(filename);
    setDownloadProgress(0);

    try {
      let assetModule: any;
      if (filename === 'Employee_Handbook_2026.pdf') {
        assetModule = require('../../assets/Employee Handbook.pdf');
      } else if (filename === 'Leave_Application_Form.pdf') {
        assetModule = require('../../assets/Leave Application Form.pdf');
      } else if (filename === 'Resignation_Template.pdf') {
        assetModule = require('../../assets/Resignation Template.pdf');
      } else {
        throw new Error('Unknown document: ' + filename);
      }

      const asset = Asset.fromModule(assetModule);
      await asset.downloadAsync();

      for (let p = 20; p <= 100; p += 20) {
        setDownloadProgress(p);
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      const localUri = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.copyAsync({
        from: asset.localUri || asset.uri,
        to: localUri
      });

      setDownloadingFile(null);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Open ${filename.replace(/_/g, ' ')}`,
          UTI: 'com.adobe.pdf'
        });
      } else {
        Alert.alert(
          language === 'fil' ? 'Matagumpay' : 'Success',
          language === 'fil'
            ? `Matagumpay na na-save ang ${filename} sa iyong device.`
            : `${filename} has been saved successfully to your device.`
        );
      }
    } catch (err: any) {
      setDownloadingFile(null);
      console.error('Failed to download form asset:', err);
      Alert.alert(
        language === 'fil' ? 'Kabiguan' : 'Error',
        language === 'fil'
          ? 'Hindi ma-download ang file: ' + err.message
          : 'Could not download file: ' + err.message
      );
    }
  };

  useEffect(() => {
    let timer: any;
    let pollInterval: any;
    let channel: any;

    if (isWaitingForScan && session) {
      setScanCountdown(180);
      const startTime = new Date().toISOString();
      const bufferedStartTime = new Date(Date.now() - 15000).toISOString(); // 15s clock drift buffer

      // Subscribe to Supabase Realtime for this user's scans
      channel = supabase
        .channel('biometric_scans_' + session.user.id)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'physical_biometric_scans',
            filter: `employee_id=eq.${session.user.id}`
          },
          (payload) => {
            console.log('Realtime fingerprint scan detected:', payload);
            const scanTime = new Date(payload.new.scanned_at).getTime();
            const startMs = new Date(startTime).getTime();
            if (scanTime >= startMs - 5000) { // allow a 5s buffer
              handleBiometricScanSuccess();
            }
          }
        )
        .subscribe();

      // Polling fallback
      pollInterval = setInterval(async () => {
        const online = await checkIsOnline();
        if (!online) return;
        try {
          const { data, error } = await supabase
            .from('physical_biometric_scans')
            .select('scanned_at')
            .eq('employee_id', session.user.id)
            .gte('scanned_at', bufferedStartTime)
            .order('scanned_at', { ascending: false })
            .limit(1);

          if (!error && data && data.length > 0) {
            console.log("Polling detected fingerprint scan:", data[0]);
            handleBiometricScanSuccess();
          }
        } catch (err) {
          console.warn("Polling biometric scan error:", err);
        }
      }, 3000);

      // 3-minute Countdown
      timer = setInterval(() => {
        setScanCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            clearInterval(pollInterval);
            if (channel) supabase.removeChannel(channel);
            setIsWaitingForScan(false);
            setScanType(null);
            scanTypeRef.current = null;
            pendingLocationRef.current = null;
            Alert.alert(t('biometricVerificationFailed'), t('biometricScanTimeout'));
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
      if (pollInterval) clearInterval(pollInterval);
      if (channel) supabase.removeChannel(channel);
    };
  }, [isWaitingForScan, session?.user?.id]);

  const handleBiometricScanSuccess = async () => {
    setIsWaitingForScan(false);
    setScanType(null);
    const type = scanTypeRef.current;
    const locationResult = pendingLocationRef.current;
    
    scanTypeRef.current = null;
    pendingLocationRef.current = null;
    
    if (type === 'in') {
      await executeTimeIn(locationResult);
    } else if (type === 'out') {
      await executeTimeOut(locationResult);
    }
  };

  const [language, setLanguage] = useState<Locale>('en');

  useEffect(() => {
    activeAppLanguage = language;
  }, [language]);

  useEffect(() => {
    const checkCopilot = async () => {
      const neverShow = await AsyncStorage.getItem('COPILOT_NEVER_SHOW');
      if (neverShow !== 'true' && session) {
        setTimeout(() => {
          Alert.alert(
            language === 'fil' ? 'Mabilis na Tour' : 'Quick Tour',
            language === 'fil' ? 'Gusto mo bang kumuha ng mabilis na tour sa app?' : 'Would you like a quick tour of the app features?',
            [
              { text: language === 'fil' ? 'Simulan' : 'Start Tour', onPress: () => startCopilot() },
              { text: language === 'fil' ? 'Laktawan' : 'Skip', style: 'cancel' },
              { text: language === 'fil' ? 'Huwag nang ipaalala' : 'Never remind me again', style: 'destructive', onPress: () => AsyncStorage.setItem('COPILOT_NEVER_SHOW', 'true') }
            ]
          );
        }, 1500);
      }
    };
    checkCopilot();
  }, [session, language]);

  const langAnim = React.useRef(new Animated.Value(0)).current;

  const t = (key: keyof typeof TRANSLATIONS['en'] | string, replaceParams?: Record<string, string | number>) => {
    const currentLangDict = TRANSLATIONS[language] || TRANSLATIONS['en'];
    let text = (currentLangDict as any)[key] || (TRANSLATIONS['en'] as any)[key] || key;
    if (replaceParams) {
      Object.entries(replaceParams).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };

  const getBilingualText = (text: string, lang: 'en' | 'fil' | 'ja') => {
    if (!text) return '';
    const parts = text.split('|');
    if (parts.length > 1) {
      return lang === 'fil' ? parts[1].trim() : parts[0].trim();
    }
    return text.trim();
  };

  const changeLanguage = async (newLang: Locale) => {
    setLanguage(newLang);
    await AsyncStorage.setItem('APP_LANGUAGE', newLang);
    Animated.spring(langAnim, {
      toValue: newLang === 'en' ? 0 : 1,
      useNativeDriver: true,
      friction: 8,
      tension: 50
    }).start();
  };

  useEffect(() => {
    AsyncStorage.getItem('APP_LANGUAGE').then((storedLang) => {
      if (storedLang === 'en' || storedLang === 'fil') {
        const lang = storedLang as Locale;
        setLanguage(lang);
        langAnim.setValue(lang === 'en' ? 0 : 1);
      }
    });
  }, []);

  const [dtrLogs, setDtrLogs] = useState<any[]>([]);
  const [dtrLoading, setDtrLoading] = useState(false);
  const [showDtrModal, setShowDtrModal] = useState(false);

  const fetchDtrLogs = async () => {
    if (!session) return;
    const online = await checkIsOnline();
    setIsOnline(online);

    if (!online) {
      console.log("App is offline, loading DTR logs from cache...");
      try {
        const cached = await AsyncStorage.getItem('CACHED_DTR_LOGS_' + session.user.id);
        setDtrLogs(cached ? JSON.parse(cached) : []);
      } catch (cacheErr) {
        console.error("Failed to read DTR logs cache", cacheErr);
      }
      return;
    }

    setDtrLoading(true);
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data, error } = await supabase.from('time_logs')
        .select('*')
        .eq('technician_id', session.user.id)
        .gte('created_at', startOfMonth)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDtrLogs(data || []);
      await AsyncStorage.setItem('CACHED_DTR_LOGS_' + session.user.id, JSON.stringify(data || []));
    } catch (e: any) {
      console.warn("Failed to fetch DTR logs:", e.message);
      setIsOnline(false);
      try {
        const cached = await AsyncStorage.getItem('CACHED_DTR_LOGS_' + session.user.id);
        if (cached) setDtrLogs(JSON.parse(cached));
      } catch (cacheErr) {}
    } finally {
      setDtrLoading(false);
    }
  };

  // Opening splash transition states
  const splashOpacity = React.useRef(new Animated.Value(1)).current;
  const logoOpacity = React.useRef(new Animated.Value(0)).current;
  const logoScale = React.useRef(new Animated.Value(0.85)).current;
  const taglineOpacity = React.useRef(new Animated.Value(0)).current;
  const taglineTranslateY = React.useRef(new Animated.Value(10)).current;
  const [splashVisible, setSplashVisible] = useState(true);

  // Offline queue state
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  const checkQueueStatus = async () => { await AsyncStorage.removeItem('OFFLINE_TRANSACTION_QUEUE'); 
    const queue = await syncQueue.getQueue();
    setOfflineQueueCount(queue.length);
  };

  useEffect(() => {
    // Check auth cache, TTL and trigger biometrics if offline
    const initAuth = async () => {
      try {
        const storedSessionStr = await getSecureItem('USER_SESSION');
        if (!storedSessionStr) {
          return;
        }

        const storedSession = JSON.parse(storedSessionStr);
        
        // TTL Check: 24 hours
        const lastOnlineStr = await AsyncStorage.getItem('LAST_ONLINE_TIMESTAMP');
        const now = new Date();
        let isExpired = false;
        
        if (lastOnlineStr) {
          const lastOnline = new Date(lastOnlineStr);
          const diffMs = now.getTime() - lastOnline.getTime();
          if (diffMs > 24 * 60 * 60 * 1000) {
            isExpired = true;
          }
        } else {
          isExpired = true;
        }

        if (isExpired) {
          await deleteSecureItem('USER_SESSION');
          await AsyncStorage.removeItem('LAST_ONLINE_TIMESTAMP');
          await supabase.auth.signOut();
          
          Alert.alert(
            t('offlineSessionExpired'),
            t('offlineSessionExpiredMsg')
          );
          return;
        }

        // Within 24-hour limit
        const onlineStatus = await checkIsOnline();
        setIsOnline(onlineStatus);
        if (onlineStatus) {
          setSession(storedSession);
          try {
            await supabase.auth.setSession({
              access_token: storedSession.access_token,
              refresh_token: storedSession.refresh_token
            });
          } catch (e) {
            console.warn("Online setSession failed:", e);
          }
          await AsyncStorage.setItem('LAST_ONLINE_TIMESTAMP', now.toISOString());
        } else {
          // Offline biometric gate
          const authenticated = await authenticateBiometrics();
          if (authenticated) {
            setSession(storedSession);
            try {
              await supabase.auth.setSession({
                access_token: storedSession.access_token,
                refresh_token: storedSession.refresh_token
              });
            } catch (e) {
              console.warn("Offline setSession failed:", e);
            }
            setIsLocked(false);
          } else {
            setIsLocked(true);
          }
        }
      } catch (err) {
        console.warn("Init auth error", err);
      }
    };

    const startupSequence = async () => {
      // 1. Start logo entry animation
      const animPromise = new Promise<void>((resolve) => {
        Animated.parallel([
          Animated.timing(logoOpacity, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.spring(logoScale, {
            toValue: 1,
            friction: 6,
            tension: 40,
            useNativeDriver: true,
          }),
          Animated.timing(taglineOpacity, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(taglineTranslateY, {
            toValue: 0,
            duration: 900,
            useNativeDriver: true,
          }),
        ]).start(() => resolve());
      });

      // 2. Run auth checks in parallel
      const authPromise = initAuth();

      // 3. Wait for animation, auth check, and a minimum 1-second hold
      await Promise.all([animPromise, authPromise, new Promise(r => setTimeout(r, 1000))]);

      // 4. Fade out splash
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        setSplashVisible(false);
      });
    };

    let lastUserId: string | null = null;

    // Listen to Supabase auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      const currentUserId = currentSession?.user?.id || null;
      if (currentUserId !== lastUserId) {
        lastUserId = currentUserId;
        // Clear old state immediately on auth change to avoid dirty state leaks
        setProfile(null);
        setSchedules([]);
        setPayslip(null);
        setActiveTimeLog(null);
        setLeaves([]);
        setActiveTab('home');
      }

      setSession(currentSession);
      if (currentSession) {
        await setSecureItem('USER_SESSION', JSON.stringify(currentSession));
        const onlineStatus = await checkIsOnline();
        setIsOnline(onlineStatus);
        if (onlineStatus) {
          await AsyncStorage.setItem('LAST_ONLINE_TIMESTAMP', new Date().toISOString());
        }
        await fetchDashboardData(currentSession.user.id);
        registerForPushNotificationsAsync(currentSession.user.id);
      } else if (event === 'SIGNED_OUT') {
        await deleteSecureItem('USER_SESSION');
        await AsyncStorage.removeItem('LAST_ONLINE_TIMESTAMP');
      }
    });

    startupSequence();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received in foreground:', notification);
    });
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response received:', response);
    });
    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  // Offline sync loop
  useEffect(() => {
    checkQueueStatus();

    const interval = setInterval(async () => {
      const online = await checkIsOnline();
      setIsOnline(online);

      const queue = await syncQueue.getQueue();
      if (queue.length > 0 && online) {
        console.log('Background checking connection to sync queue...');
        const res = await syncQueue.syncPendingQueue((item) => {
          if (item.type === 'time_in' || item.type === 'time_out') {
            if (session) fetchDashboardData(session.user.id);
          }
        });
        checkQueueStatus();
        if (res.syncedCount > 0) {
          Alert.alert('Sync Successful', `Synchronized ${res.syncedCount} offline transaction(s) with database.`);
        }
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [session]);

  // Web-specific online/offline window listeners
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleOnline = () => {
        setIsOnline(true);
        if (session) {
          fetchDashboardData(session.user.id);
          syncQueue.getQueue().then(queue => {
            if (queue.length > 0) {
              syncQueue.syncPendingQueue((item) => {
                if (item.type === 'time_in' || item.type === 'time_out') {
                  fetchDashboardData(session.user.id);
                }
              }).then(res => {
                checkQueueStatus();
                if (res.syncedCount > 0) {
                  Alert.alert('Sync Successful', `Synchronized ${res.syncedCount} offline transaction(s) with database.`);
                }
              });
            }
          });
        }
      };
      const handleOffline = () => {
        setIsOnline(false);
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, [session]);

  // Real-time Announcements Sync
  useEffect(() => {
    let channel: any;
    if (session) {
      channel = supabase
        .channel('announcements_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'announcements' },
          async (payload) => {
            console.log('Realtime announcement change detected:', payload);
            try {
              // Re-fetch latest announcements to ensure correct sorting and details
              const { data, error } = await supabase
                .from('announcements')
                .select('*')
                .order('created_at', { ascending: false });

              if (error) {
                console.error("Failed to fetch announcements in realtime update:", error.message);
                return;
              }

              if (data) {
                setAnnouncements(data);

                // Update AsyncStorage cache
                try {
                  const cached = await AsyncStorage.getItem('CACHED_DASHBOARD_' + session.user.id);
                  if (cached) {
                    const dashboardCache = JSON.parse(cached);
                    dashboardCache.announcements = data;
                    await AsyncStorage.setItem('CACHED_DASHBOARD_' + session.user.id, JSON.stringify(dashboardCache));
                  }
                } catch (cacheErr: any) {
                  console.warn("Failed to update dashboard announcements cache:", cacheErr.message);
                }

                // Alert user of new announcement if event is INSERT
                if (payload.eventType === 'INSERT') {
                  const newAnn = payload.new;
                  const userBranchId = profile?.branch_id;
                  
                  // Only alert if global or targets user's branch
                  if (!newAnn.target_branch_id || newAnn.target_branch_id === userBranchId) {
                    const title = getBilingualText(newAnn.title, language);
                    const content = getBilingualText(newAnn.content, language);
                    Alert.alert(
                      language === 'fil' ? 'Bagong Anunsyo!' : 'New Announcement!',
                      `${title}\n\n${content}`
                    );
                  }
                }
              }
            } catch (err: any) {
              console.error("Error handling realtime announcement change:", err.message || err);
            }
          }
        )
        .subscribe();
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [session, profile, language]);


  // Real-time Global Sync (Schedules, Leaves, Time Logs, Profiles, Payslips, OT, Disputes)
  useEffect(() => {
    let channel: any;
    if (session) {
      channel = supabase
        .channel('global_technician_realtime')
        .on(
          'postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'schedules',
            filter: `technician_id=eq.${session.user.id}`
          },
          async (payload) => {
            console.log('Realtime schedule change detected:', payload);
            await fetchDashboardData(session.user.id);
          }
        )
        .on(
          'postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'leaves',
            filter: `technician_id=eq.${session.user.id}`
          },
          async (payload) => {
            console.log('Realtime leave status change detected:', payload);
            await fetchDashboardData(session.user.id);
            await fetchLeaves();
          }
        )
        .on(
          'postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'time_logs',
            filter: `technician_id=eq.${session.user.id}`
          },
          async (payload) => {
            console.log('Realtime time log change detected:', payload);
            await fetchDashboardData(session.user.id);
            
            if (payload.eventType === 'UPDATE') {
              const updatedLog = payload.new;
              setActiveTimeLog((prev: any) => {
                if (prev && prev.id === updatedLog.id) {
                  // If rejected, alert the user!
                  if (updatedLog.photo_status === 'rejected' && prev.photo_status !== 'rejected') {
                    Alert.alert(
                      language === 'fil' ? 'Tinanggihan' : 'Attendance Rejected', 
                      language === 'fil' ? 'Ang iyong selfie ay tinanggihan ng admin. Mangyaring mag-Clock In muli.' : 'Your clock-in selfie was rejected by the admin. Please clock in again.'
                    );
                  }
                  // If approved, alert the user!
                  else if (updatedLog.photo_status === 'approved' && prev.photo_status === 'pending') {
                    Alert.alert(
                      language === 'fil' ? 'Inaprubahan' : 'Attendance Approved', 
                      language === 'fil' ? 'Ang iyong selfie ay inaprubahan.' : 'Your clock-in selfie was approved by the admin.'
                    );
                  }
                  return { ...prev, ...updatedLog };
                }
                return prev;
              });
            }
          }
        )
        .on(
          'postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'profiles',
            filter: `id=eq.${session.user.id}`
          },
          async (payload) => {
            console.log('Realtime profile change detected:', payload);
            await fetchDashboardData(session.user.id);
          }
        )
        .on(
          'postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'payslips',
            filter: `technician_id=eq.${session.user.id}`
          },
          async (payload) => {
            console.log('Realtime payslip change detected:', payload);
            await fetchDashboardData(session.user.id);
          }
        )
        .on(
          'postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'overtime_requests',
            filter: `technician_id=eq.${session.user.id}`
          },
          async (payload) => {
            console.log('Realtime OT request change detected:', payload);
            await fetchDashboardData(session.user.id);
          }
        )
        .on(
          'postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'payroll_disputes',
            filter: `technician_id=eq.${session.user.id}`
          },
          async (payload) => {
            console.log('Realtime dispute change detected:', payload);
            await fetchDashboardData(session.user.id);
          }
        )
        .subscribe();
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [session, language]);

  const loadDashboardDataFromCache = async (userId: string) => {
    try {
      const cached = await AsyncStorage.getItem('CACHED_DASHBOARD_' + userId);
      if (cached) {
        const dashboardCache = JSON.parse(cached);
        if (dashboardCache.profile) setProfile(dashboardCache.profile);
        setSchedules(dashboardCache.schedules || []);
        setPayslip(dashboardCache.payslip);
        setAnnouncements(dashboardCache.announcements || []);
        
        const cachedLogs = dashboardCache.logs || [];
        
        // Apply offline queue overrides to cached logs
        const queue = await syncQueue.getQueue();
        const pendingTimeIn = queue.find(item => item.type === 'time_in' && item.payload.technician_id === userId);
        
        let finalActiveLog: any = null;
        if (pendingTimeIn) {
          finalActiveLog = {
            id: 'offline-pending-' + pendingTimeIn.id,
            technician_id: userId,
            app_time_in: pendingTimeIn.payload.app_time_in,
            app_time_out: pendingTimeIn.payload.app_time_out || null,
            total_hours: pendingTimeIn.payload.total_hours || null,
            latitude: pendingTimeIn.payload.latitude,
            longitude: pendingTimeIn.payload.longitude,
            geofence_status: 'inside',
            is_offline_pending: true
          };
        } else if (cachedLogs.length > 0) {
          const lastLog = cachedLogs[0];
          const logDate = new Date(lastLog.app_time_in);
          const todayDate = new Date();
          const isToday = logDate.getFullYear() === todayDate.getFullYear() &&
                          logDate.getMonth() === todayDate.getMonth() &&
                          logDate.getDate() === todayDate.getDate();
          
          if (!lastLog.app_time_out || isToday) {
            finalActiveLog = { ...lastLog };
            const pendingTimeOut = queue.find(item => item.type === 'time_out' && item.payload.log_id === finalActiveLog.id);
            if (pendingTimeOut) {
              finalActiveLog.app_time_out = pendingTimeOut.payload.app_time_out;
              finalActiveLog.total_hours = pendingTimeOut.payload.total_hours;
            }
          }
        }
        setActiveTimeLog(finalActiveLog);
      } else {
        // Clear state if no cache exists for this user
        setProfile(null);
        setSchedules([]);
        setPayslip(null);
        setActiveTimeLog(null);
        setLeaves([]);
      }
    } catch (cacheErr) {
      console.error("Failed to read dashboard cache", cacheErr);
    }
  };

  const fetchDashboardData = async (userId: string) => {
    const online = await checkIsOnline();
    setIsOnline(online);

    if (!online) {
      console.log("App is offline, loading dashboard data from cache directly...");
      await loadDashboardDataFromCache(userId);
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      
      const fetchProfilePromise = supabase.from('profiles').select('*').eq('id', userId).single();
      const fetchSchedulesPromise = supabase.from('schedules').select('*, senior_partner:profiles!senior_partner_id(full_name)').eq('technician_id', userId).order('start_time', { ascending: true });
      const fetchPayslipsPromise = supabase.from('payslips').select('*').eq('technician_id', userId).eq('status', 'published').order('created_at', { ascending: false });
      const fetchTimeLogsPromise = supabase.from('time_logs')
        .select('*')
        .eq('technician_id', userId)
        .gte('created_at', new Date(Date.now() - 86400000).toISOString())
        .order('created_at', { ascending: false })
        .limit(10);
      const fetchAnnouncementsPromise = supabase.from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      const fetchLeavesPromise = supabase.from('leaves')
        .select('*')
        .eq('technician_id', userId)
        .order('created_at', { ascending: false });

      const [profResult, schedsResult, payslipsResult, logsResult, announcementsResult, leavesResult] = await withTimeout(
        Promise.all([fetchProfilePromise, fetchSchedulesPromise, fetchPayslipsPromise, fetchTimeLogsPromise, fetchAnnouncementsPromise, fetchLeavesPromise]),
        20000
      );

      const isNetworkErr = (err: any) => {
        if (!err) return false;
        const msg = err.message || '';
        return msg.includes('fetch') || msg.includes('Network') || msg.includes('timeout') || err.status === 0 || err.status >= 500;
      };

      if (profResult.error && isNetworkErr(profResult.error)) throw profResult.error;
      if (schedsResult.error && isNetworkErr(schedsResult.error)) throw schedsResult.error;
      if (payslipsResult.error && isNetworkErr(payslipsResult.error)) throw payslipsResult.error;
      if (logsResult.error && isNetworkErr(logsResult.error)) throw logsResult.error;
      if (announcementsResult.error && isNetworkErr(announcementsResult.error)) throw announcementsResult.error;
      if (leavesResult.error && isNetworkErr(leavesResult.error)) throw leavesResult.error;

      const prof = profResult.data;
      const scheds = schedsResult.data || [];
      const pay = payslipsResult.data && payslipsResult.data.length > 0 ? payslipsResult.data[0] : null;
      setPayslips(payslipsResult.data || []);
      const logs = logsResult.data || [];
      const anns = announcementsResult.data || [];
      const leaves = leavesResult.data || [];
      setLeaves(leaves);

      if (prof) setProfile(prof);
      setSchedules(scheds);
      setPayslip(pay);
      setAnnouncements(anns);

      // Check for leave status changes
      try {
        const lastKnownLeavesStr = await AsyncStorage.getItem('LAST_KNOWN_LEAVES_' + userId);
        if (lastKnownLeavesStr) {
          const lastKnownLeaves = JSON.parse(lastKnownLeavesStr) as any[];
          for (const newLeave of leaves) {
            const matchingOld = lastKnownLeaves.find(o => o.id === newLeave.id);
            if (matchingOld && matchingOld.status === 'pending' && newLeave.status !== 'pending') {
              // Found status change!
              setLeaveAlert({
                id: newLeave.id,
                type: newLeave.leave_type,
                status: newLeave.status,
                startDate: newLeave.start_date,
                endDate: newLeave.end_date
              });
              
              Alert.alert(
                language === 'fil' ? 'Update sa Pagliban' : 'Leave Request Update',
                language === 'fil'
                  ? `Ang iyong hiling sa pagliban (${newLeave.leave_type}) mula ${newLeave.start_date} hanggang ${newLeave.end_date} ay naging ${newLeave.status === 'approved' ? 'INAPRUBAHAN' : 'TINANGGIHAN'}.`
                  : `Your leave request (${newLeave.leave_type}) from ${newLeave.start_date} to ${newLeave.end_date} has been ${newLeave.status.toUpperCase()}.`
              );
            }
          }
        }
        await AsyncStorage.setItem('LAST_KNOWN_LEAVES_' + userId, JSON.stringify(leaves));
      } catch (leaveErr) {
        console.warn("Error checking leave status changes:", leaveErr);
      }

      // Apply offline queue overrides to time logs
      const queue = await syncQueue.getQueue();
      const pendingTimeIn = queue.find(item => item.type === 'time_in' && item.payload.technician_id === userId);
      
      let finalActiveLog: any = null;
      if (pendingTimeIn) {
        finalActiveLog = {
          id: 'offline-pending-' + pendingTimeIn.id,
          technician_id: userId,
          app_time_in: pendingTimeIn.payload.app_time_in,
          app_time_out: pendingTimeIn.payload.app_time_out || null,
          total_hours: pendingTimeIn.payload.total_hours || null,
          latitude: pendingTimeIn.payload.latitude,
          longitude: pendingTimeIn.payload.longitude,
          geofence_status: 'inside',
          is_offline_pending: true
        };
      } else if (logs.length > 0) {
        const lastLog = logs[0];
        const logDate = new Date(lastLog.app_time_in);
        const todayDate = new Date();
        const isToday = logDate.getFullYear() === todayDate.getFullYear() &&
                        logDate.getMonth() === todayDate.getMonth() &&
                        logDate.getDate() === todayDate.getDate();
        
        if (!lastLog.app_time_out || isToday) {
          finalActiveLog = { ...lastLog };
          const pendingTimeOut = queue.find(item => item.type === 'time_out' && item.payload.log_id === finalActiveLog.id);
          if (pendingTimeOut) {
            finalActiveLog.app_time_out = pendingTimeOut.payload.app_time_out;
            finalActiveLog.total_hours = pendingTimeOut.payload.total_hours;
          }
        }
      }
      setActiveTimeLog(finalActiveLog);
      if (finalActiveLog && !finalActiveLog.app_time_out) {
        await AsyncStorage.setItem('ACTIVE_USER_ID', userId);
        startBackgroundLocationTracking();
      } else {
        stopBackgroundLocationTracking();
      }

      // Save to cache
      const dashboardCache = {
        profile: prof,
        schedules: scheds,
        payslip: pay,
        logs: logs,
        announcements: anns,
        leaves: leaves,
        cachedAt: new Date().toISOString()
      };
      await AsyncStorage.setItem('CACHED_DASHBOARD_' + userId, JSON.stringify(dashboardCache));
      await AsyncStorage.setItem('LAST_ONLINE_TIMESTAMP', new Date().toISOString());
    } catch (e: any) {
      console.warn("Failed to load dashboard data from network, trying cache:", e.message);
      setIsOnline(false);
      await loadDashboardDataFromCache(userId);
    }
  };

  const fetchLeaves = async () => {
    if (!session) return;
    setLeavesLoading(true);
    try {
      const { data, error } = await supabase
        .from('leaves')
        .select('*')
        .eq('technician_id', session.user.id)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setLeaves(data);
      }
    } catch (e) {
      console.warn("Failed to fetch leaves", e);
    } finally {
      setLeavesLoading(false);
    }
  };

  const handleSelectLeaveAttachment = async () => {
    if (Platform.OS === 'web') {
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['image/*', 'application/pdf'],
          copyToCacheDirectory: true
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          setLeaveAttachment({
            uri: asset.uri,
            name: asset.name,
            type: asset.mimeType?.startsWith('image/') ? 'image' : 'document'
          });
        }
      } catch (err) {
        console.warn("Web attachment picker error:", err);
      }
      return;
    }

    try {
      Alert.alert(
        'Attach Document',
        'Choose attachment type',
        [
          {
            text: 'Upload Photo (Gallery)',
            onPress: async () => {
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== 'granted') return;
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.7,
              });
              if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                setLeaveAttachment({
                  uri: asset.uri,
                  name: asset.fileName || `leave-attachment-${Date.now()}.jpg`,
                  type: 'image'
                });
              }
            }
          },
          {
            text: 'Upload Document (PDF)',
            onPress: async () => {
              const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf'],
                copyToCacheDirectory: true
              });
              if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                setLeaveAttachment({
                  uri: asset.uri,
                  name: asset.name,
                  type: 'document'
                });
              }
            }
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } catch (err) {
      console.warn("Attachment picker error:", err);
    }
  };

  const handleApplyLeaveSubmit = async () => {
    if (!session) return;
    if (!leaveStartDate || !leaveEndDate || !leaveReason || !leaveAttachment) {
      Alert.alert('Missing Fields', 'Please fill in all required fields and upload an attachment.');
      return;
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(leaveStartDate) || !dateRegex.test(leaveEndDate)) {
      Alert.alert('Invalid Date Format', 'Dates must be in YYYY-MM-DD format.');
      return;
    }

    setLeaveSubmitLoading(true);
    try {
      let attachmentUrl = null;

      if (leaveAttachment) {
        const response = await fetch(leaveAttachment.uri);
        const blob = await response.blob();
        const fileExt = leaveAttachment.name.split('.').pop() || 'jpg';
        const fileName = `${session.user.id}/leave-${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('leaves')
          .upload(fileName, blob, {
            contentType: leaveAttachment.type === 'image' ? `image/${fileExt === 'png' ? 'png' : 'jpeg'}` : 'application/pdf',
            upsert: true
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('leaves')
          .getPublicUrl(fileName);
        
        attachmentUrl = publicUrl;
      }

      const { error: insertError } = await supabase
        .from('leaves')
        .insert({
          technician_id: session.user.id,
          start_date: leaveStartDate,
          end_date: leaveEndDate,
          leave_type: leaveType,
          reason: leaveReason,
          status: 'pending',
          attachment_url: attachmentUrl
        });

      if (insertError) throw insertError;

      Alert.alert('Success', 'Your leave request has been submitted.');
      setShowApplyLeaveModal(false);
      setLeaveStartDate('');
      setLeaveEndDate('');
      setLeaveReason('');
      setLeaveAttachment(null);
      await fetchLeaves();
    } catch (err: any) {
      console.error("Leave submit error:", err);
      Alert.alert('Submission Failed', err.message || 'An error occurred.');
    } finally {
      setLeaveSubmitLoading(false);
    }
  };

  const handleOtSubmit = async () => {
    if (!session) return;
    if (!otReason.trim()) {
      Alert.alert(language === 'fil' ? 'May Error' : 'Error', language === 'fil' ? 'Mangyaring ilagay ang dahilan.' : 'Please enter a reason.');
      return;
    }
    const hoursNum = parseFloat(otHours);
    if (isNaN(hoursNum) || hoursNum <= 0 || hoursNum > 24) {
      Alert.alert(language === 'fil' ? 'May Error' : 'Error', language === 'fil' ? 'Maling bilang ng oras.' : 'Invalid hours amount.');
      return;
    }

    setOtSubmitting(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from('overtime_requests')
        .insert({
          technician_id: session.user.id,
          request_date: todayStr,
          requested_hours: hoursNum,
          reason: otReason.trim(),
          status: 'pending'
        });

      if (error) {
        if (error.message.includes('unique_tech_date_ot')) {
          Alert.alert(
            language === 'fil' ? 'Mayroon Na' : 'Duplicate Request',
            language === 'fil'
              ? 'Nakapag-submit ka na ng overtime request para sa araw na ito.'
              : 'You have already submitted an overtime request for this date.'
          );
        } else {
          throw error;
        }
      } else {
        Alert.alert(
          language === 'fil' ? 'Matagumpay' : 'Success',
          language === 'fil'
            ? 'Naipadala na ang iyong overtime request para sa approval ng admin.'
            : 'Your overtime request has been submitted for admin approval.'
        );
        setShowOtModal(false);
        setOtReason("");
        setOtHours("1");
      }
    } catch (err: any) {
      console.error("Overtime submission error:", err);
      Alert.alert('Submission Failed', err.message || 'An error occurred.');
    } finally {
      setOtSubmitting(false);
    }
  };

  const handleSelectDisputeAttachment = async () => {
    if (Platform.OS === 'web') {
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['image/*', 'application/pdf'],
          copyToCacheDirectory: true
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          setDisputeAttachment({
            uri: asset.uri,
            name: asset.name,
            type: asset.mimeType?.startsWith('image/') ? 'image' : 'document'
          });
        }
      } catch (err) {
        console.warn("Web dispute attachment picker error:", err);
      }
      return;
    }

    try {
      Alert.alert(
        'Attach Supporting Document',
        'Choose attachment type',
        [
          {
            text: 'Upload Photo (Gallery)',
            onPress: async () => {
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== 'granted') return;
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.7,
              });
              if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                setDisputeAttachment({
                  uri: asset.uri,
                  name: asset.fileName || `dispute-attachment-${Date.now()}.jpg`,
                  type: 'image'
                });
              }
            }
          },
          {
            text: 'Upload Document (PDF)',
            onPress: async () => {
              const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf'],
                copyToCacheDirectory: true
              });
              if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                setDisputeAttachment({
                  uri: asset.uri,
                  name: asset.name,
                  type: 'document'
                });
              }
            }
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } catch (err) {
      console.warn("Dispute attachment picker error:", err);
    }
  };

  const handleApplyDisputeSubmit = async () => {
    if (!session || !payslip) return;
    if (!disputeReason.trim() || !disputeAttachment) {
      Alert.alert('Missing Fields', 'Please state the reason for your dispute and select a supporting document.');
      return;
    }

    setDisputeSubmitLoading(true);
    try {
      let attachmentUrl = null;

      if (disputeAttachment) {
        const response = await fetch(disputeAttachment.uri);
        const blob = await response.blob();
        const fileExt = disputeAttachment.name.split('.').pop() || 'jpg';
        const fileName = `${session.user.id}/dispute-${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('payroll-disputes')
          .upload(fileName, blob, {
            contentType: disputeAttachment.type === 'image' ? `image/${fileExt === 'png' ? 'png' : 'jpeg'}` : 'application/pdf',
            upsert: true
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('payroll-disputes')
          .getPublicUrl(fileName);
        
        attachmentUrl = publicUrl;
      }

      const { error: insertError } = await supabase
        .from('payroll_disputes')
        .insert({
          technician_id: session.user.id,
          payslip_id: payslip.id,
          reason: disputeReason.trim(),
          attachment_url: attachmentUrl,
          status: 'pending'
        });

      if (insertError) throw insertError;

      Alert.alert('Dispute Submitted', 'Your payroll dispute has been filed and will be reviewed by HR/accounting.');
      setShowDisputeModal(false);
      setDisputeReason('');
      setDisputeAttachment(null);
    } catch (err: any) {
      console.error("Dispute submit error:", err);
      Alert.alert('Submission Failed', err.message || 'An error occurred.');
    } finally {
      setDisputeSubmitLoading(false);
    }
  };

  const startBackgroundLocationTracking = async () => {
    if (Platform.OS === 'web') {
      console.log("Background location updates not supported on Web platform.");
      return;
    }
    try {
      const { status: foreStatus } = await Location.requestForegroundPermissionsAsync();
      if (foreStatus !== 'granted') {
        console.warn("Foreground location permission denied");
        return;
      }
      const { status: backStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backStatus !== 'granted') {
        console.warn("Background location permission denied");
        return;
      }

      const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (!hasStarted) {
        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5 * 60 * 1000,
          distanceInterval: 50,
          foregroundService: {
            notificationTitle: "TechnoSys Location Tracking",
            notificationBody: "Tracking location to verify field service routing.",
            notificationColor: COLORS.primary
          }
        });
        console.log("Background location tracking started!");
      }
    } catch (e) {
      console.error("Failed to start background location updates:", e);
    }
  };

  const stopBackgroundLocationTracking = async () => {
    if (Platform.OS === 'web') {
      return;
    }
    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (hasStarted) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        console.log("Background location tracking stopped!");
      }
    } catch (e) {
      console.error("Failed to stop background location updates:", e);
    }
  };

  const handleUploadAvatar = async () => {
    if (!session) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access gallery is required to upload a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      setAvatarUploading(true);
      const uri = result.assets[0].uri;

      const response = await fetch(uri);
      const blob = await response.blob();
      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `${session.user.id}/avatar-${Date.now()}.${fileExt}`;

      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, {
          contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
          upsert: true
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', session.user.id);

      if (updateError) {
        throw updateError;
      }

      Alert.alert('Success', 'Profile picture updated successfully!');
      await fetchDashboardData(session.user.id);
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      Alert.alert('Upload Failed', err.message || 'An error occurred while uploading your avatar.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const executeTimeIn = async (locationResult: any) => {
    if (!session) return;
    setTimeInLoading(true);

    try {
      const isSuspicious = (locationResult.timeDrift && locationResult.timeDrift > 15 * 60 * 1000) || false;
      const timeInPayload = {
        technician_id: session.user.id,
        app_time_in: new Date().toISOString(),
        latitude: locationResult.latitude,
        longitude: locationResult.longitude,
        geofence_status: 'inside',
        is_mocked: locationResult.isMocked || false,
        gps_accuracy: locationResult.gpsAccuracy || null,
        is_suspicious: isSuspicious
      };

      const { error } = await supabase.from('time_logs').insert(timeInPayload);

      if (error) {
        const errMessage = error.message || '';
        const status = (error as any).status;
        const isNetworkError = errMessage.includes('fetch') || errMessage.includes('Network') || errMessage.includes('timeout') || status === 0 || status >= 500;
        
        if (isNetworkError) {
          const queuePayload = {
            ...timeInPayload,
            time_drift_at_creation: locationResult.timeDrift || null
          };
          await syncQueue.addToQueue('time_in', queuePayload);
          const mockLog = {
            id: 'offline-pending-' + Date.now(),
            technician_id: session.user.id,
            app_time_in: timeInPayload.app_time_in,
            latitude: timeInPayload.latitude,
            longitude: timeInPayload.longitude,
            geofence_status: 'inside',
            is_offline_pending: true
          };
          setActiveTimeLog(mockLog);
          Alert.alert(t('biometricScanMatched'), t('syncPendingAlertDesc'));
          checkQueueStatus();
          return;
        }
        throw error;
      }

      Alert.alert(t('biometricScanMatched'), t('locationVerified'));
      await fetchDashboardData(session.user.id);
    } catch (e: any) {
      Alert.alert('Time In Failed', e.message || 'An error occurred.');
    } finally {
      setTimeInLoading(false);
    }
  };

  const executeTimeOut = async (locationResult: any) => {
    if (!session || !activeTimeLog) return;
    setTimeOutLoading(true);

    try {
      const timeOutTime = new Date().toISOString();
      const timeInMs = new Date(activeTimeLog.app_time_in).getTime();
      const timeOutMs = new Date(timeOutTime).getTime();
      const diffHours = Number(((timeOutMs - timeInMs) / (1000 * 60 * 60)).toFixed(2));

      const isOfflinePending = activeTimeLog.is_offline_pending;
      const isSuspicious = (locationResult?.timeDrift && locationResult.timeDrift > 15 * 60 * 1000) || false;

      if (isOfflinePending) {
        const queue = await syncQueue.getQueue();
        const timeInItemIndex = queue.findIndex(item => item.type === 'time_in' && item.payload.app_time_in === activeTimeLog.app_time_in);
        
        if (timeInItemIndex !== -1) {
          queue[timeInItemIndex].payload.app_time_out = timeOutTime;
          queue[timeInItemIndex].payload.total_hours = diffHours;
          queue[timeInItemIndex].payload.is_suspicious = queue[timeInItemIndex].payload.is_suspicious || isSuspicious;
          await AsyncStorage.setItem('OFFLINE_TRANSACTION_QUEUE', JSON.stringify(queue));
        } else {
          await syncQueue.addToQueue('time_out', {
            log_id: activeTimeLog.id,
            app_time_out: timeOutTime,
            total_hours: diffHours,
            is_suspicious: isSuspicious,
            time_drift_at_creation: locationResult?.timeDrift || null
          });
        }
        
        setActiveTimeLog((prev: any) => ({
          ...prev,
          app_time_out: timeOutTime,
          total_hours: diffHours
        }));
        Alert.alert(t('biometricScanMatched'), t('syncPendingAlertOut', { hours: diffHours }));
        checkQueueStatus();
        return;
      }

      const { error } = await supabase.from('time_logs')
        .update({
          app_time_out: timeOutTime,
          total_hours: diffHours,
          is_suspicious: isSuspicious
        })
        .eq('id', activeTimeLog.id);

      if (error) {
        const errMessage = error.message || '';
        const status = (error as any).status;
        const isNetworkError = errMessage.includes('fetch') || errMessage.includes('Network') || errMessage.includes('timeout') || status === 0 || status >= 500;

        if (isNetworkError) {
          await syncQueue.addToQueue('time_out', {
            log_id: activeTimeLog.id,
            app_time_out: timeOutTime,
            total_hours: diffHours,
            is_suspicious: isSuspicious,
            time_drift_at_creation: locationResult?.timeDrift || null
          });
          setActiveTimeLog((prev: any) => ({
            ...prev,
            app_time_out: timeOutTime,
            total_hours: diffHours
          }));
          Alert.alert(t('biometricScanMatched'), t('syncPendingAlertOut', { hours: diffHours }));
          checkQueueStatus();
          return;
        }
        throw error;
      }

      setActiveTimeLog((prev: any) => ({ ...prev, app_time_out: timeOutTime, total_hours: diffHours })); Alert.alert(t('biometricScanMatched'), t('workedHours', { hours: diffHours }));
      await fetchDashboardData(session.user.id);
    } catch (e: any) {
      Alert.alert('Time Out Failed', e.message || 'An error occurred.');
    } finally {
      setTimeOutLoading(false);
    }
  };

  const getActiveDirectOrTravelSchedule = () => {
    if (!schedules || schedules.length === 0) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    
    return schedules.find(s => {
      if (s.attendance_mode !== 'direct_dispatch' && s.attendance_mode !== 'out_of_town') return false;
      const start = new Date(s.start_time);
      start.setHours(0, 0, 0, 0);
      const end = s.end_time ? new Date(s.end_time) : start;
      end.setHours(0, 0, 0, 0);
      return todayTime >= start.getTime() && todayTime <= end.getTime();
    });
  };

  const getTodaySchedule = () => {
    if (!schedules || schedules.length === 0) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    
    return schedules.find(s => {
      const start = new Date(s.start_time);
      start.setHours(0, 0, 0, 0);
      const end = s.end_time ? new Date(s.end_time) : start;
      end.setHours(0, 0, 0, 0);
      return todayTime >= start.getTime() && todayTime <= end.getTime();
    });
  };

  const handleTimeIn = async () => {
    if (!session) return;
    setTimeInLoading(true);

    try {
      // 1. Check if they have a dispatch schedule for today
      const todaySched = getTodaySchedule();
      if (!todaySched) {
        Alert.alert(
          language === 'fil' ? 'Walang Dispatch' : 'No Dispatch Assigned',
          language === 'fil'
            ? 'Maaari ka lamang mag-clock in kung mayroon kang nakatalagang dispatch assignment para sa araw na ito.'
            : 'You can only clock in if you have an assigned dispatch/work schedule for today.'
        );
        setTimeInLoading(false);
        return;
      }

      // 2. Prevent clock-in earlier than 1 hour before scheduled start
      const schedStart = new Date(todaySched.start_time);
      const now = new Date();
      const oneHourBeforeStart = new Date(schedStart.getTime() - 60 * 60 * 1000);
      
      if (now < oneHourBeforeStart) {
        const timeStr = oneHourBeforeStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        Alert.alert(
          language === 'fil' ? 'Masyadong Maaga' : 'Clock-In Too Early',
          language === 'fil'
            ? `Maaari ka lamang mag-clock in simula ${timeStr} (1 oras bago ang iyong shift).`
            : `You can only clock in starting at ${timeStr} (1 hour before your scheduled shift).`
        );
        setTimeInLoading(false);
        return;
      }

      // 3. Fallback to existing bypass checking for direct dispatches
      const activeSched = getActiveDirectOrTravelSchedule();
      if (activeSched) {
        // Bypass geofence check and biometric fingerprint scan
        const currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
        const locationResult = {
          status: 'inside',
          latitude: currentLoc?.coords.latitude || 14.5995,
          longitude: currentLoc?.coords.longitude || 120.9842,
          isMocked: false,
          gpsAccuracy: currentLoc?.coords.accuracy || 10,
          timeDrift: 0
        };
        
        // Execute DTR log using the scheduled start time authoritatively (or current time for out-of-town)
        const timeInPayload = {
          technician_id: session.user.id,
          app_time_in: activeSched.attendance_mode === 'out_of_town'
            ? new Date().toISOString()
            : activeSched.start_time,
          latitude: locationResult.latitude,
          longitude: locationResult.longitude,
          geofence_status: 'inside',
          is_mocked: false,
          gps_accuracy: locationResult.gpsAccuracy || null,
          is_suspicious: false
        };

        const { error } = await supabase.from('time_logs').insert(timeInPayload);

        if (error) {
          const errMessage = error.message || '';
          const status = (error as any).status;
          const isNetworkError = errMessage.includes('fetch') || errMessage.includes('Network') || errMessage.includes('timeout') || status === 0 || status >= 500;
          
          if (isNetworkError) {
            await syncQueue.addToQueue('time_in', {
              ...timeInPayload,
              time_drift_at_creation: 0
            });
            const mockLog = {
              id: 'offline-pending-' + Date.now(),
              technician_id: session.user.id,
              app_time_in: timeInPayload.app_time_in,
              latitude: timeInPayload.latitude,
              longitude: timeInPayload.longitude,
              geofence_status: 'inside',
              is_offline_pending: true
            };
            setActiveTimeLog(mockLog);
            Alert.alert(t('biometricScanMatched') || 'Success', t('syncPendingAlertDesc'));
            checkQueueStatus();
            return;
          }
          throw error;
        }

        Alert.alert(
          language === 'fil' ? 'Matagumpay' : 'Success',
          language === 'fil'
            ? 'Awtomatikong na-verify ang iyong clock-in batay sa iyong direktang dispatch/out-of-town na schedule.'
            : 'Your clock-in has been automatically verified based on your direct dispatch/out-of-town schedule.'
        );
        await fetchDashboardData(session.user.id);
        return;
      }

      const locationResult = await geofence.checkLocation();

      if (!locationResult || locationResult.status !== 'inside') {
        setTimeInLoading(false);
        const errMsg = locationResult?.errorKey 
          ? (locationResult.errorKey === 'poorGpsSignal' && locationResult.gpsAccuracy 
              ? t(locationResult.errorKey, { accuracy: Math.round(locationResult.gpsAccuracy) }) 
              : t(locationResult.errorKey))
          : (locationResult?.error || 'Could not verify your location. Please try again.');
        Alert.alert(
          t('locationVerificationFailed'),
          errMsg,
          [{ text: 'OK' }]
        );
        return;
      }

      // Proximity verified, transition to biometric waiting state
      scanTypeRef.current = 'in';
      pendingLocationRef.current = locationResult;
      setIsWaitingForScan(true);
      setScanType('in');
    } catch (e: any) {
      Alert.alert('Time In Failed', e.message || 'An error occurred.');
    } finally {
      setTimeInLoading(false);
    }
  };

  const handleTimeOut = async () => {
    if (!session || !activeTimeLog) return;
    setTimeOutLoading(true);

    try {
      const activeSched = getActiveDirectOrTravelSchedule();
      if (activeSched) {
        // Bypass geofence check and biometric fingerprint scan
        const currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
        const locationResult = {
          status: 'inside',
          latitude: currentLoc?.coords.latitude || 14.5995,
          longitude: currentLoc?.coords.longitude || 120.9842,
          isMocked: false,
          gpsAccuracy: currentLoc?.coords.accuracy || 10,
          timeDrift: 0
        };
        await executeTimeOut(locationResult);
        return;
      }

      const locationResult = await geofence.checkLocation();

      if (!locationResult || locationResult.status !== 'inside') {
        setTimeOutLoading(false);
        const errMsg = locationResult?.errorKey 
          ? (locationResult.errorKey === 'poorGpsSignal' && locationResult.gpsAccuracy 
              ? t(locationResult.errorKey, { accuracy: Math.round(locationResult.gpsAccuracy) }) 
              : t(locationResult.errorKey))
          : (locationResult?.error || 'Could not verify your location. Please try again.');
        Alert.alert(
          t('locationVerificationFailed'),
          errMsg,
          [{ text: 'OK' }]
        );
        return;
      }

      // Proximity verified, transition to biometric waiting state
      scanTypeRef.current = 'out';
      pendingLocationRef.current = locationResult;
      setIsWaitingForScan(true);
      setScanType('out');
    } catch (e: any) {
      Alert.alert('Time Out Failed', e.message || 'An error occurred.');
    } finally {
      setTimeOutLoading(false);
    }
  };

  const formatPhp = (amount: number) => {
    if (!amount) return '₱ 0.00';
    return `₱ ${Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderAppContent = () => {
    if (isLocked) {
      return (
        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
            <Feather name="lock" size={64} color={COLORS.danger} style={{ marginBottom: 24 }} />
            <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.textMain, marginBottom: 8 }}>
              {t('lockedScreenTitle')}
            </Text>
            <Text style={{ fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginBottom: 32, paddingHorizontal: 20 }}>
              {t('lockedScreenDesc')}
            </Text>
            <TouchableOpacity 
              style={{ 
                backgroundColor: COLORS.primary, 
                paddingHorizontal: 24, 
                paddingVertical: 14, 
                borderRadius: 12, 
                flexDirection: 'row', 
                alignItems: 'center',
                shadowColor: COLORS.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8
              }}
              onPress={async () => {
                const authenticated = await authenticateBiometrics();
                if (authenticated) {
                  setIsLocked(false);
                  const storedSessionStr = await getSecureItem('USER_SESSION');
                  if (storedSessionStr) {
                    const storedSession = JSON.parse(storedSessionStr);
                    setSession(storedSession);
                    await supabase.auth.setSession({
                      access_token: storedSession.access_token,
                      refresh_token: storedSession.refresh_token
                    });
                  }
                }
              }}
            >
              <Feather name="shield" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                {t('retryAuth')}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    if (!session) {
      return <LoginScreen onLogin={setSession} />;
    }

    const vipSchedules = schedules.filter(s => s.is_vip_hook);
    const regularSchedules = schedules.filter(s => !s.is_vip_hook);

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={COLORS.background} />
        
        {offlineQueueCount > 0 && (
          <View style={styles.offlineBanner}>
            <Feather name="wifi-off" size={14} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.offlineBannerText}>
              {t('syncBanner', { count: offlineQueueCount })}
            </Text>
          </View>
        )}
        
        {/* Dynamic Main Content Based on Tab */}
        <FadeInView currentTab={activeTab}>
          {activeTab === 'home' && (
            <ScrollView contentContainerStyle={styles.content}>
              {/* Premium Header widget */}
              <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <View style={{ flex: 1, marginRight: 16 }}>
                  <Text style={styles.greeting}>{t('welcomeBack')}</Text>
                  <Text style={styles.name}>{profile?.full_name || 'Technician'}</Text>
                  {(() => {
                    const isTechnician = profile?.role === 'technician';
                    const isHelper = profile?.role === 'helper';
                    const badgeBg = isTechnician ? 'rgba(99, 102, 241, 0.1)' : isHelper ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)';
                    const badgeBorder = isTechnician ? 'rgba(99, 102, 241, 0.2)' : isHelper ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)';
                    const badgeText = isTechnician ? '#4f46e5' : isHelper ? '#d97706' : '#059669';
                    const badgeLabel = profile?.role ? profile.role.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : t('active');
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                        <View style={{ backgroundColor: badgeBg, borderColor: badgeBorder, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: badgeText, textTransform: 'uppercase' }}>
                            {badgeLabel}
                          </Text>
                        </View>
                      </View>
                    );
                  })()}
                </View>
                <View style={{ position: 'relative' }}>
                  <Image source={require('../../assets/technocycle_logo.png')} style={{ width: 56, height: 56, resizeMode: 'contain' }} />
                  <View style={{
                    position: 'absolute',
                    bottom: 2,
                    right: 2,
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: COLORS.background,
                    backgroundColor: isOnline ? COLORS.primary : COLORS.danger
                  }} />
                </View>
              </View>

              {/* Leave alert and Deployment info */}
              {leaveAlert && (
                <View style={{
                  backgroundColor: leaveAlert.status === 'approved' ? COLORS.primaryDim : 'rgba(239, 68, 68, 0.08)',
                  borderColor: leaveAlert.status === 'approved' ? COLORS.primary : COLORS.danger,
                  borderWidth: 1,
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{
                      fontWeight: 'bold',
                      fontSize: 14,
                      color: leaveAlert.status === 'approved' ? COLORS.primary : COLORS.danger,
                      marginBottom: 4
                    }}>
                      📢 {language === 'fil' ? 'Update sa Pagliban' : 'Leave Request Update'}
                    </Text>
                    <Text style={{
                      fontSize: 12,
                      color: COLORS.textMain,
                      lineHeight: 18
                    }}>
                      {language === 'fil'
                        ? `Ang iyong hiling sa pagliban (${leaveAlert.type}) mula ${leaveAlert.startDate} hanggang ${leaveAlert.endDate} ay ${leaveAlert.status === 'approved' ? 'INAPRUBAHAN' : 'TINANGGIHAN'}.`
                        : `Your leave request (${leaveAlert.type}) from ${leaveAlert.startDate} to ${leaveAlert.endDate} has been ${leaveAlert.status.toUpperCase()}.`}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setLeaveAlert(null)} style={{ padding: 8 }}>
                    <Feather name="x" size={16} color={leaveAlert.status === 'approved' ? COLORS.primary : COLORS.danger} />
                  </TouchableOpacity>
                </View>
              )}

              {(() => {
                const activeSched = getActiveDirectOrTravelSchedule();
                const countdown = getCountdownText(activeSched);
                if (!countdown) return null;
                return (
                  <View style={{
                    backgroundColor: '#fffbeb',
                    borderColor: '#f59e0b',
                    borderWidth: 1,
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 20,
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ fontWeight: 'bold', color: '#b45309', fontSize: 14 }}>
                        ✈️ {language === 'fil' ? 'Out-of-Town Deployment' : 'Out-of-Town Deployment'}
                      </Text>
                      <Text style={{ color: '#b45309', fontWeight: 'bold', fontSize: 13 }}>
                        {countdown.daysLeft} {language === 'fil' ? 'araw na lang' : 'days left'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: COLORS.textMain, marginBottom: 8 }}>
                      {language === 'fil' 
                        ? `Araw ${countdown.elapsedDays} ng ${countdown.totalDays} ng iyong deployment.` 
                        : `Day ${countdown.elapsedDays} of ${countdown.totalDays} of your deployment.`}
                    </Text>
                    <View style={{ height: 6, backgroundColor: '#fef3c7', borderRadius: 3, overflow: 'hidden' }}>
                      <View style={{ 
                        height: '100%', 
                        backgroundColor: '#f59e0b', 
                        width: `${Math.min(100, Math.max(0, (countdown.elapsedDays / countdown.totalDays) * 100))}%` 
                      }} />
                    </View>
                  </View>
                );
              })()}

              {/* Redesigned DTR Console Card */}
              <View style={{ marginBottom: 24 }}>
                {(() => {
                  if (isWaitingForScan) {
                    return (
                      <View style={styles.scanningCard}>
                        <Animated.View style={{ transform: [{ scale: pulseAnim }], width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(16, 185, 129, 0.2)', justifyContent: 'center', alignItems: 'center' }}>
                            <MaterialCommunityIcons name="fingerprint" size={36} color={COLORS.primary} />
                          </View>
                        </Animated.View>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.textMain, textAlign: 'center', marginBottom: 6 }}>
                          {language === 'fil' ? 'Naghihintay ng Biometric Swipe...' : 'Awaiting Biometric Swipe...'}
                        </Text>
                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: COLORS.danger, marginBottom: 16 }}>
                          ⏱️ {Math.floor(scanCountdown / 60)}:{(scanCountdown % 60).toString().padStart(2, '0')}
                        </Text>
                        
                        <TouchableOpacity 
                          onPress={() => {
                            setIsWaitingForScan(false);
                            setScanType(null);
                            scanTypeRef.current = null;
                            pendingLocationRef.current = null;
                          }}
                          style={styles.cancelScanButton}
                        >
                          <Text style={{ color: COLORS.textMain, fontWeight: 'bold', fontSize: 13 }}>
                            {t('cancel')}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          onPress={() => {
                            setIsWaitingForScan(false);
                            setIsCameraMode(true);
                          }}
                          style={[styles.cancelScanButton, { backgroundColor: '#10b981', marginTop: 8 }]}
                        >
                          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>
                            📷 {language === 'fil' ? 'Gamitin ang Camera (Hybrid Mode)' : 'Use Camera (Hybrid Mode)'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }

                  if (isCameraMode) {
                    return (
                      <HybridCamera 
                        language={language as any} 
                        onCancel={() => {
                          setIsCameraMode(false);
                          setIsWaitingForScan(true);
                        }}
                        onPhotoTaken={async (photoUri) => {
                          try {
                            const response = await fetch(photoUri);
                            const blob = await response.blob();
                            let ext = 'jpg';
                            if (photoUri.startsWith('data:')) {
                               const match = photoUri.match(/data:image\/([a-zA-Z0-9]+);/);
                               if (match && match[1]) ext = match[1];
                            } else {
                               const dotIdx = photoUri.lastIndexOf('.');
                               if (dotIdx !== -1) ext = photoUri.substring(dotIdx + 1);
                            }
                            const fileName = `${session?.user?.id}-${Date.now()}.${ext}`;
                            const { data, error } = await supabase.storage.from('dtr-selfies').upload(fileName, blob);
                            if (error) {
                              Alert.alert('Upload Failed', error.message);
                              return;
                            }

                            // Proceed with time in/out logic using fileName
                            const type = scanTypeRef.current;
                            const loc = pendingLocationRef.current;
                            if (type === 'in') {
                               const timeInPayload = {
                                technician_id: session?.user?.id,
                                app_time_in: new Date().toISOString(),
                                photo_url: fileName,
                                geofence_status: loc?.status || 'inside',
                                latitude: loc?.lat || null,
                                longitude: loc?.lng || null,
                                is_mocked: false,
                                is_suspicious: false,
                                gps_accuracy: null
                              };
                              const { data: insertData, error: insertErr } = await supabase.from('time_logs').insert(timeInPayload).select().single();
                              if (insertErr) {
                                console.log("INSERT ERROR PAYLOAD:", timeInPayload);
                                console.log("INSERT ERROR:", insertErr);
                                Alert.alert('Error', insertErr.message);
                              }
                              else { 
                                setActiveTimeLog(insertData);
                                Alert.alert('Success', 'Clock In successful (Pending Approval)'); 
                                
                              }
                            } else if (type === 'out') {
                              const { error: updateErr } = await supabase.from('time_logs').update({
                                app_time_out: new Date().toISOString(),
                                is_suspicious: false
                              }).eq('technician_id', session?.user?.id).is('app_time_out', null);
                              if (updateErr) {
                                console.log("UPDATE ERROR:", updateErr);
                                Alert.alert('Error', updateErr.message);
                              }
                              else setActiveTimeLog((prev: any) => ({ ...prev, app_time_out: new Date().toISOString() })); Alert.alert('Success', 'Clock Out successful'); await fetchDashboardData(session?.user?.id);
                            }

                            setIsCameraMode(false);
                            setScanType(null);
                            scanTypeRef.current = null;
                            pendingLocationRef.current = null;
                          } catch (e: any) {
                            Alert.alert('Error', e.message);
                          }
                        }}
                      />
                    );
                  }

                  if (!activeTimeLog || activeTimeLog.photo_status === 'rejected') {
                    return (
                      <View>
                        {activeTimeLog?.photo_status === 'rejected' && (
                          <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
                            <Feather name="alert-circle" size={20} color={COLORS.danger} style={{ marginRight: 8 }} />
                            <Text style={{ color: COLORS.danger, fontSize: 13, flex: 1 }}>
                              {language === 'fil' ? 'Tinanggihan ang iyong huling selfie. Mangyaring mag-Clock In muli.' : 'Your last selfie was rejected. Please clock in again.'}
                            </Text>
                          </View>
                        )}
                        <TouchableOpacity 
                          style={styles.readyCard} 
                          onPress={handleTimeIn} 
                          disabled={timeInLoading}
                        >
                          {timeInLoading ? (
                            <ActivityIndicator color={COLORS.primary} />
                          ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                                <Feather name="map-pin" size={24} color={COLORS.primary} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: COLORS.textMain, fontWeight: '800', fontSize: 18, marginBottom: 4 }}>
                                  {language === 'fil' ? 'Mag-Clock In' : 'Locate Office & Check In'}
                                </Text>
                                <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
                                  📍 {t('locationVerificationDetails')}
                                </Text>
                              </View>
                              <Feather name="chevron-right" size={20} color={COLORS.textMuted} />
                            </View>
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  }

                  if (activeTimeLog && !activeTimeLog.app_time_out) {
                    return (
                      <View style={styles.activeCard}>
                        <Animated.View style={[StyleSheet.absoluteFill, {
                          borderWidth: 2,
                          borderColor: COLORS.primary,
                          borderRadius: 20,
                          opacity: breathingAnim
                        }]} pointerEvents="none" />
                        
                        <View style={{ alignItems: 'center', width: '100%' }}>
                          <Feather name="activity" size={24} color={COLORS.primary} style={{ marginBottom: 6 }} />
                          <Text style={{ color: COLORS.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {language === 'fil' ? 'KASALUKUYANG SHIFT' : 'ACTIVE SHIFT'}
                          </Text>
                          
                          {activeTimeLog.photo_status === 'pending' && (
                            <View style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 6 }}>
                              <Text style={{ color: '#d97706', fontSize: 11, fontWeight: 'bold' }}>PENDING APPROVAL</Text>
                            </View>
                          )}
                          
                          <ActiveShiftTimer startTime={activeTimeLog.app_time_in} />
                          
                          <Text style={{ color: COLORS.textMuted, fontSize: 11, marginBottom: 16 }}>
                            {t('loggedAt', { time: new Date(activeTimeLog.app_time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}
                          </Text>

                          <TouchableOpacity 
                            style={{
                              backgroundColor: 'rgba(79, 70, 229, 0.08)',
                              borderWidth: 1,
                              borderColor: 'rgba(79, 70, 229, 0.2)',
                              paddingVertical: 12,
                              paddingHorizontal: 16,
                              borderRadius: 14,
                              width: '100%',
                              alignItems: 'center',
                              marginBottom: 0,
                              flexDirection: 'row',
                              justifyContent: 'center',
                              gap: 6
                            }}
                            onPress={() => setShowOtModal(true)}
                          >
                            <Feather name="clock" size={14} color={COLORS.primary} />
                            <Text style={{ color: COLORS.primary, fontWeight: '800', fontSize: 13 }}>
                              {language === 'fil' ? 'Mag-request ng Overtime' : 'File Overtime Request'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  }

                  return (
                    <View style={styles.completedCard}>
                      <Feather name="check-circle" size={28} color={COLORS.textMuted} style={{ marginBottom: 8 }} />
                      <Text style={{ color: COLORS.textMain, fontWeight: '800', fontSize: 18, marginBottom: 4 }}>
                        {t('shiftCompleted')}
                      </Text>
                      <Text style={{ color: COLORS.textMuted, fontSize: 13, textAlign: 'center' }}>
                        {t('workedHours', { hours: activeTimeLog.total_hours })}
                      </Text>
                      <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 4 }}>
                        ({new Date(activeTimeLog.app_time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(activeTimeLog.app_time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                      </Text>
                    </View>
                  );
                })()}

                {/* Collapsible Proximity / Map Section */}
                {!geofence.latitude ? (
                  <View style={{ marginTop: 12 }}>
                    <TouchableOpacity
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: COLORS.primary,
                        backgroundColor: COLORS.primaryDim,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onPress={async () => {
                        await geofence.checkLocation();
                      }}
                      disabled={geofence.status === 'checking'}
                    >
                      {geofence.status === 'checking' ? (
                        <ActivityIndicator color={COLORS.primary} size="small" style={{ marginRight: 8 }} />
                      ) : (
                        <Feather name="map" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                      )}
                      <Text style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: 13 }}>
                        {geofence.status === 'checking' ? (t('checkingLocation') || 'Checking Location...') : t('checkProximity')}
                      </Text>
                    </TouchableOpacity>

                    {geofence.error && (
                      <View style={{
                        marginTop: 8,
                        padding: 10,
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        borderColor: COLORS.danger,
                        borderWidth: 1,
                        borderRadius: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}>
                        <Feather name="alert-triangle" size={14} color={COLORS.danger} style={{ marginRight: 8 }} />
                        <Text style={{ color: COLORS.danger, fontSize: 11, fontWeight: '600', flex: 1 }}>{geofence.error}</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={{ marginTop: 12 }}>
                    <View style={{
                      padding: 12,
                      borderRadius: 12,
                      backgroundColor: geofence.status === 'inside' ? COLORS.primaryDim : 'rgba(239, 68, 68, 0.08)',
                      borderWidth: 1,
                      borderColor: geofence.status === 'inside' ? COLORS.primary : COLORS.danger,
                      marginBottom: 8,
                      flexDirection: 'row',
                      alignItems: 'center'
                    }}>
                      <Feather 
                        name={geofence.status === 'inside' ? "check-circle" : "alert-triangle"} 
                        size={16} 
                        color={geofence.status === 'inside' ? COLORS.primary : COLORS.danger} 
                        style={{ marginRight: 8 }} 
                      />
                      <Text style={{ 
                        flex: 1, 
                        fontSize: 12, 
                        color: geofence.status === 'inside' ? COLORS.primary : COLORS.danger, 
                        fontWeight: '600' 
                      }}>
                        {geofence.status === 'inside' 
                          ? t('verifiedInside', { office: geofence.matchingOfficeName || '', distance: Math.round(geofence.distance || 0) })
                          : (geofence.status === 'error' && geofence.errorKey
                              ? (geofence.errorKey === 'poorGpsSignal' && geofence.gpsAccuracy
                                  ? t(geofence.errorKey, { accuracy: Math.round(geofence.gpsAccuracy) })
                                  : t(geofence.errorKey))
                              : (geofence.error || t('outsideArea', { distance: Math.round(geofence.distance || 0) })))
                        }
                        {"  "}
                        <Text style={{ fontSize: 9, color: '#10b981', fontWeight: 'bold' }}>
                          ● Live
                        </Text>
                      </Text>
                      {/* Refresh Proximity Button */}
                      <TouchableOpacity 
                        onPress={() => geofence.selectedOfficeId && geofence.checkLocation(geofence.selectedOfficeId)} 
                        style={{ padding: 4, marginRight: 8 }}
                      >
                        <Feather name="refresh-cw" size={14} color={geofence.status === 'inside' ? COLORS.primary : COLORS.danger} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={geofence.reset} style={{ padding: 4 }}>
                        <Feather name="x" size={14} color={geofence.status === 'inside' ? COLORS.primary : COLORS.danger} />
                      </TouchableOpacity>
                    </View>

                    {/* Custom Branch Selector Dropdown */}
                    {geofence.offices && geofence.offices.length > 0 && (() => {
                      const selectedOffice = geofence.offices.find(o => o.id === geofence.selectedOfficeId) || geofence.offices[0];
                      return (
                        <View style={{ marginBottom: 8, zIndex: 10 }}>
                          <TouchableOpacity
                            onPress={() => setBranchDropdownOpen(!branchDropdownOpen)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: COLORS.primary,
                              backgroundColor: COLORS.card,
                            }}
                          >
                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.textMain }}>
                              🏢 Selected Branch: {selectedOffice.name}
                            </Text>
                            <Feather name={branchDropdownOpen ? "chevron-up" : "chevron-down"} size={16} color={COLORS.primary} />
                          </TouchableOpacity>

                          {branchDropdownOpen && (
                            <View style={{
                              marginTop: 4,
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: COLORS.border,
                              backgroundColor: COLORS.card,
                              maxHeight: 180,
                              overflow: 'hidden',
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.1,
                              shadowRadius: 4,
                              elevation: 3,
                            }}>
                              <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 180 }}>
                                {geofence.offices.map((office: any) => {
                                  const isSelected = office.id === geofence.selectedOfficeId;
                                  return (
                                    <TouchableOpacity
                                      key={office.id}
                                      onPress={() => {
                                        geofence.checkLocation(office.id);
                                        setBranchDropdownOpen(false);
                                      }}
                                      style={{
                                        paddingHorizontal: 12,
                                        paddingVertical: 10,
                                        borderBottomWidth: 1,
                                        borderBottomColor: COLORS.border,
                                        backgroundColor: isSelected ? COLORS.primaryDim : COLORS.card,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                      }}
                                    >
                                      <Text style={{ 
                                        fontSize: 12, 
                                        fontWeight: isSelected ? 'bold' : 'normal', 
                                        color: isSelected ? COLORS.primary : COLORS.textMain 
                                      }}>
                                        🏢 {office.name} ({office.radius_meters}m)
                                      </Text>
                                      {isSelected && <Feather name="check" size={14} color={COLORS.primary} />}
                                    </TouchableOpacity>
                                  );
                                })}
                              </ScrollView>
                            </View>
                          )}
                        </View>
                      );
                    })()}

                    <GeofenceMobileMap
                      userLat={geofence.latitude || 0}
                      userLng={geofence.longitude || 0}
                      branchLat={geofence.officeLatitude || 0}
                      branchLng={geofence.officeLongitude || 0}
                      radius={geofence.officeRadius || 50}
                      branchName={geofence.matchingOfficeName || 'Office'}
                    />
                  </View>
                )}
              </View>

              {/* Premium Styled Announcements Section */}
              {(() => {
                const filteredAnnouncements = announcements.filter(ann => 
                  !ann.target_branch_id || ann.target_branch_id === profile?.branch_id
                );
                if (filteredAnnouncements.length === 0) return null;

                return (
                  <View style={{ marginBottom: 24 }}>
                    <Text style={styles.sectionTitleMain}>{t('announcementsLabel')}</Text>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      snapToInterval={280 + 16}
                      decelerationRate="fast"
                      contentContainerStyle={{ paddingRight: 16 }}
                    >
                      {filteredAnnouncements.map((ann) => (
                        <TouchableOpacity 
                          key={ann.id} 
                          onPress={() => setSelectedAnnouncement(ann)}
                          activeOpacity={0.8}
                          style={{
                            width: 280,
                            backgroundColor: COLORS.card,
                            borderRadius: 20,
                            borderWidth: 1,
                            borderColor: COLORS.border,
                            padding: 16,
                            marginRight: 16,
                            position: 'relative',
                            overflow: 'hidden'
                          }}
                        >
                          <View style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: 4,
                            bottom: 0,
                            backgroundColor: '#6366f1'
                          }} />
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingLeft: 6 }}>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#6366f1', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              📢 {ann.target_branch_id ? (language === 'fil' ? 'Sangay' : 'Branch') : 'Global'}
                            </Text>
                            <Text style={{ fontSize: 9, color: COLORS.textMuted }}>
                              {new Date(ann.created_at).toLocaleDateString(language === 'fil' ? 'fil-PH' : 'en-US', { month: 'long', day: 'numeric' })}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 14, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 6, paddingLeft: 6 }} numberOfLines={1}>
                            {getBilingualText(ann.title, language)}
                          </Text>
                          <Text style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 18, paddingLeft: 6 }} numberOfLines={3}>
                            {getBilingualText(ann.content, language)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                );
              })()}

              {/* Redesigned Priority Dispatch Cards */}
              <Text style={styles.sectionTitleMain}>{t('priorityDispatch')}</Text>
              {vipSchedules.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Feather name="check-square" size={32} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
                  <Text style={{ color: COLORS.textMain, fontWeight: '700', fontSize: 15, marginBottom: 4 }}>
                    {language === 'fil' ? 'Lahat ay Naisagawa!' : 'All caught up!'}
                  </Text>
                  <Text style={{ color: COLORS.textMuted, fontSize: 13, textAlign: 'center' }}>
                    {language === 'fil' ? 'Walang nakatakdang priority dispatch para sa araw na ito.' : 'No priority dispatches scheduled for today.'}
                  </Text>
                </View>
              ) : (
                vipSchedules.map(sched => (
                  <View key={sched.id} style={[styles.dispatchCard, { borderLeftColor: '#ef4444', borderLeftWidth: 4 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <View style={[styles.dispatchBadge, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)', borderWidth: 1 }]}>
                        <Text style={[styles.dispatchBadgeText, { color: '#ef4444' }]}>{t('urgent').toUpperCase()}</Text>
                      </View>
                      {sched.attendance_mode && (
                        <View style={styles.attendanceBadge}>
                          <Text style={styles.attendanceBadgeText}>
                            💼 {sched.attendance_mode === 'hq' ? 'HQ Standard' : (sched.attendance_mode === 'direct_dispatch' ? (language === 'fil' ? 'Direktang Dispatch' : 'Direct Dispatch') : (language === 'fil' ? 'Labas ng Bayan' : 'Out-of-Town'))}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.dispatchTitle}>{sched.client_name}</Text>
                    <Text style={styles.dispatchTime}><Feather name="clock" size={12}/> {formatTime(sched.start_time)}{sched.end_time ? ` - ${formatTime(sched.end_time)}` : ''}</Text>
                    
                    <TouchableOpacity onPress={() => openDirections(sched.location)} style={styles.directionsButton}>
                      <Feather name="map-pin" size={12} color={COLORS.primary} style={{ marginRight: 6 }} />
                      <Text style={styles.directionsButtonText} numberOfLines={1}>{sched.location}</Text>
                      <Feather name="corner-up-right" size={14} color={COLORS.primary} style={{ marginLeft: 'auto' }} />
                    </TouchableOpacity>

                    {sched.senior_partner?.full_name && (
                      <View style={styles.partnerRow}>
                        <Feather name="user" size={12} color={COLORS.textMain} style={{ marginRight: 6 }} />
                        <Text style={{ fontSize: 12, color: COLORS.textMain, fontWeight: '700' }}>
                          {language === 'fil' ? 'Senior Tech: ' : 'Senior Partner: '}
                          <Text style={{ fontWeight: 'normal' }}>{sched.senior_partner.full_name}</Text>
                        </Text>
                      </View>
                    )}
                  </View>
                ))
              )}

              {/* Redesigned Standard Schedule Cards */}
              <Text style={[styles.sectionTitleMain, { marginTop: 24 }]}>{t('standardSchedule')}</Text>
              {regularSchedules.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Feather name="check-square" size={32} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
                  <Text style={{ color: COLORS.textMain, fontWeight: '700', fontSize: 15, marginBottom: 4 }}>
                    {language === 'fil' ? 'Lahat ay Naisagawa!' : 'All caught up!'}
                  </Text>
                  <Text style={{ color: COLORS.textMuted, fontSize: 13, textAlign: 'center' }}>
                    {language === 'fil' ? 'Walang nakatakdang dispatch para sa araw na ito.' : 'No dispatches scheduled for today.'}
                  </Text>
                </View>
              ) : (
                regularSchedules.map(sched => (
                  <View key={sched.id} style={[styles.dispatchCard, { borderLeftColor: '#64748b', borderLeftWidth: 4 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <View style={[styles.dispatchBadge, { backgroundColor: 'rgba(100, 116, 139, 0.1)', borderColor: 'rgba(100, 116, 139, 0.2)', borderWidth: 1 }]}>
                        <Text style={[styles.dispatchBadgeText, { color: '#64748b' }]}>{language === 'fil' ? 'KARANIWAN' : 'STANDARD'}</Text>
                      </View>
                      {sched.attendance_mode && (
                        <View style={styles.attendanceBadge}>
                          <Text style={styles.attendanceBadgeText}>
                            💼 {sched.attendance_mode === 'hq' ? 'HQ Standard' : (sched.attendance_mode === 'direct_dispatch' ? (language === 'fil' ? 'Direktang Dispatch' : 'Direct Dispatch') : (language === 'fil' ? 'Labas ng Bayan' : 'Out-of-Town'))}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.dispatchTitle}>{sched.client_name}</Text>
                    <Text style={styles.dispatchTime}><Feather name="clock" size={12}/> {formatTime(sched.start_time)}{sched.end_time ? ` - ${formatTime(sched.end_time)}` : ''}</Text>
                    
                    <TouchableOpacity onPress={() => openDirections(sched.location)} style={styles.directionsButton}>
                      <Feather name="map-pin" size={12} color={COLORS.primary} style={{ marginRight: 6 }} />
                      <Text style={styles.directionsButtonText} numberOfLines={1}>{sched.location}</Text>
                      <Feather name="corner-up-right" size={14} color={COLORS.primary} style={{ marginLeft: 'auto' }} />
                    </TouchableOpacity>

                    {sched.senior_partner?.full_name && (
                      <View style={styles.partnerRow}>
                        <Feather name="user" size={12} color={COLORS.textMain} style={{ marginRight: 6 }} />
                        <Text style={{ fontSize: 12, color: COLORS.textMain, fontWeight: '700' }}>
                          {language === 'fil' ? 'Senior Tech: ' : 'Senior Partner: '}
                          <Text style={{ fontWeight: 'normal' }}>{sched.senior_partner.full_name}</Text>
                        </Text>
                      </View>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          )}

          {activeTab === 'payslip' && (
            <>
            <ScrollView contentContainerStyle={styles.content}>
              <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }]}>
                <Text style={styles.name}>{t('payrollTab') || 'My Earnings'}</Text>
                <Image source={require('../../assets/technocycle_logo.png')} style={{ width: 56, height: 56, resizeMode: 'contain' }} />
              </View>

              <TextInput 
                placeholder={language === 'fil' ? 'Hanapin ang Petsa o Halaga...' : 'Search Date or Amount...'} 
                placeholderTextColor={COLORS.textMuted}
                style={{ backgroundColor: COLORS.card, padding: 14, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, color: COLORS.textMain }}
                value={searchPayslip}
                onChangeText={setSearchPayslip}
              />

              {payslips && payslips.length > 0 ? (
                [payslips[0]].map((p, idx) => {
                  const payslip = p;
                    const cycleLogs = dtrLogs.filter(log => {
                      const logDate = log.created_at ? log.created_at.split('T')[0] : '';
                      return logDate >= payslip.period_start && logDate <= payslip.period_end;
                    });
                    const daysWorked = cycleLogs.length || 10;
                    const totalHours = cycleLogs.reduce((sum, log) => sum + Number(log.total_hours || 0), 0) || (daysWorked * 8);
                    
                    const baseHourlyRate = Number(profile?.base_salary || 20000) / 208;
                    const expectedRegularPay = baseHourlyRate * totalHours;
                    const holidayBonus = Math.max(0, Number(payslip.gross_pay) - expectedRegularPay);
                    const holidayHours = holidayBonus > 0 ? Math.round(holidayBonus / (baseHourlyRate * 0.3)) : 0;
                    
                    const withholdingTax = Math.max(0, Number(payslip.gross_pay) - Number(payslip.sss_deduction) - Number(payslip.philhealth_deduction) - Number(payslip.pagibig_deduction) - Number(payslip.net_pay));

                    return (
                      <TouchableOpacity 
                        key={idx} 
                        style={styles.payslipCard}
                        onPress={() => {
                          setPayslip(payslip);
                          setShowPayslipDetailsModal(true);
                        }}
                      >
                        <Text style={styles.sectionTitle}>{language === 'fil' ? 'Huling Payslip' : 'Payslip Record'}</Text>
                        <Text style={styles.period}>{language === 'fil' ? 'Siklo' : 'Cycle'}: {payslip.period_start} to {payslip.period_end}</Text>
                        
                        <View style={[styles.netPayBox, { marginBottom: 0 }]}>
                          <Text style={styles.netPayLabel}>{language === 'fil' ? 'Kabuuang Netong Sahod' : 'Net Take-Home Pay'}</Text>
                          <Text style={styles.netPayAmount}>{formatPhp(payslip.net_pay)}</Text>
                        </View>
                        <View style={{ marginTop: 16, alignItems: 'center' }}>
                          <Text style={{ color: COLORS.primary, fontWeight: 'bold' }}>{language === 'fil' ? 'Tingnan ang Detalye' : 'View Full Details'} &rarr;</Text>
                        </View>
                      </TouchableOpacity>
                    );
                })
              ) : (
                <View style={[styles.payslipCard, { alignItems: 'center', paddingVertical: 60 }]}>
                  <Feather name="file-text" size={48} color={COLORS.border} style={{ marginBottom: 16 }} />
                  <Text style={{ color: COLORS.textMuted }}>No published payslips found.</Text>
                </View>
              )}
            </ScrollView>

            <Modal visible={showPayslipHistory} animationType="slide" transparent={true} onRequestClose={() => setShowPayslipHistory(false)}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                <View style={{ backgroundColor: COLORS.background, height: '80%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.textMain }}>{language === 'fil' ? 'Kasaysayan ng Payslip' : 'Payslip History'}</Text>
                    <TouchableOpacity onPress={() => setShowPayslipHistory(false)}>
                      <Feather name="x" size={24} color={COLORS.textMain} />
                    </TouchableOpacity>
                  </View>
                  <TextInput 
                    placeholder={language === 'fil' ? 'Hanapin ang Petsa...' : 'Search Date...'} 
                    placeholderTextColor={COLORS.textMuted}
                    style={{ backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border }}
                    value={searchPayslip}
                    onChangeText={setSearchPayslip}
                  />
                  <ScrollView>
                    {payslips.filter(p => p.period_start.includes(searchPayslip) || p.period_end.includes(searchPayslip) || (p.net_pay && p.net_pay.toString().includes(searchPayslip))).map((p, idx) => (
                      <TouchableOpacity key={idx} style={{ padding: 16, backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border }} onPress={() => { setShowPayslipHistory(false); setPayslip(p); setShowDisputeModal(true); }}>
                        <Text style={{ fontWeight: 'bold', color: COLORS.textMain }}>{new Date(p.period_start).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - {new Date(p.period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
                        <Text style={{ color: COLORS.primary, marginTop: 4 }}>Net Pay: {Number(p.net_pay).toLocaleString('en-US', { style: 'currency', currency: 'PHP' })}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </Modal>
            </>
          )}



          {activeTab === 'schedules' && (
            <SchedulesTab userId={session.user.id} language={language} isOnline={isOnline} />
          )}

          {activeTab === 'tickets' && (
            <TicketsTab userId={session.user.id} fullName={profile?.full_name || 'Technician'} language={language} isOnline={isOnline} isDarkMode={isDarkMode} />
          )}




          {activeTab === 'profile' && (
            <ScrollView contentContainerStyle={styles.content}>
            <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }]}>
                <Text style={[styles.name, { flex: 1, marginRight: 16 }]}>{t('profileTitle')}</Text>
                <TouchableOpacity onPress={handleLogoTap} activeOpacity={0.7}>
                  <Image source={require('../../assets/technocycle_logo.png')} style={{ width: 56, height: 56, resizeMode: 'contain' }} />
                </TouchableOpacity>
              </View>

              {/* Avatar Header Row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, marginBottom: 24 }}>
                <TouchableOpacity 
                  onPress={handleUploadAvatar}
                  disabled={avatarUploading}
                  style={{ position: 'relative', marginRight: 16 }}
                >
                  <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primaryDim, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {avatarUploading ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : profile?.avatar_url ? (
                      <Image source={{ uri: profile.avatar_url }} style={{ width: 64, height: 64 }} />
                    ) : (
                      <Text style={{ color: COLORS.primary, fontSize: 24, fontWeight: 'bold' }}>{profile?.full_name?.charAt(0) || 'T'}</Text>
                    )}
                  </View>
                  <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: COLORS.primary, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.card }}>
                    <Feather name="camera" size={10} color="#fff" />
                  </View>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: COLORS.textMain, fontSize: 18, fontWeight: 'bold', marginBottom: 2 }}>{profile?.full_name}</Text>
                  <Text style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 6 }}>
                    {profile?.role ? profile.role.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : t('active')}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isOnline ? COLORS.primary : COLORS.danger, marginRight: 6 }} />
                    <Text style={{ color: isOnline ? COLORS.primary : COLORS.danger, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {isOnline ? t('online') : t('offline')}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Account Group Card */}
              <Text style={{ color: COLORS.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>
                {t('accountSection')}
              </Text>
              <View style={{ backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, padding: 8, marginBottom: 20 }}>
                <TouchableOpacity 
                  onPress={() => { setShowDtrModal(true); fetchDtrLogs(); }}
                  style={{ padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(16, 185, 129, 0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Feather name="clock" size={16} color={COLORS.primary} />
                    </View>
                    <Text style={{ color: COLORS.textMain, fontWeight: '600', fontSize: 14 }}>{t('dtrLabel')}</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Document Management System (DMS) Group Card */}
              <Text style={{ color: COLORS.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>
                {t('companyFormsLabel')}
              </Text>
              <View style={{ backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, padding: 8, marginBottom: 20 }}>
                {/* Employee Handbook */}
                <TouchableOpacity 
                  onPress={() => startFormDownload('Employee_Handbook_2026.pdf')}
                  style={{ padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.border }}
                  disabled={!!downloadingFile}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(59, 130, 246, 0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Feather name="book-open" size={16} color="#3b82f6" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COLORS.textMain, fontWeight: '600', fontSize: 14 }}>Employee Handbook.pdf</Text>
                      {downloadingFile === 'Employee_Handbook_2026.pdf' && (
                        <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '700', marginTop: 2 }}>{t('downloading')} {downloadProgress}%</Text>
                      )}
                    </View>
                  </View>
                  <Feather name="download" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>

                {/* File Leave Directly (Interactive Portal) */}
                <TouchableOpacity 
                  onPress={() => setActiveTab('tickets')}
                  style={{ padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.border }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(16, 185, 129, 0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Feather name="calendar" size={16} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COLORS.textMain, fontWeight: '600', fontSize: 14 }}>{language === 'fil' ? 'Aplikasyon sa Leave' : 'Leave Requests Portal'}</Text>
                      <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 2 }}>{language === 'fil' ? 'Mag-apply at tingnan ang mga leave online' : 'Apply and track leave requests online'}</Text>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>

                {/* Leave Application Form */}
                <TouchableOpacity 
                  onPress={() => startFormDownload('Leave_Application_Form.pdf')}
                  style={{ padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.border }}
                  disabled={!!downloadingFile}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(16, 185, 129, 0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Feather name="file-text" size={16} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COLORS.textMain, fontWeight: '600', fontSize: 14 }}>Leave Application Form.pdf</Text>
                      {downloadingFile === 'Leave_Application_Form.pdf' && (
                        <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '700', marginTop: 2 }}>{t('downloading')} {downloadProgress}%</Text>
                      )}
                    </View>
                  </View>
                  <Feather name="download" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>

                {/* Resignation Template */}
                <TouchableOpacity 
                  onPress={() => startFormDownload('Resignation_Template.pdf')}
                  style={{ padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                  disabled={!!downloadingFile}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(239, 68, 68, 0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Feather name="file-minus" size={16} color={COLORS.danger} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COLORS.textMain, fontWeight: '600', fontSize: 14 }}>Resignation Template.pdf</Text>
                      {downloadingFile === 'Resignation_Template.pdf' && (
                        <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '700', marginTop: 2 }}>{t('downloading')} {downloadProgress}%</Text>
                      )}
                    </View>
                  </View>
                  <Feather name="download" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Preferences Group Card */}
              <Text style={{ color: COLORS.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>
                {t('preferencesSection')}
              </Text>
              <View style={{ backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, padding: 8, marginBottom: 20 }}>
                <View style={{ padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(59, 130, 246, 0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Feather name="globe" size={16} color="#3b82f6" />
                    </View>
                    <Text style={{ color: COLORS.textMain, fontWeight: '600', fontSize: 14 }}>{t('languageLabel')}</Text>
                  </View>
                  
                  {/* Segmented language switcher */}
                  <View style={{ position: 'relative', width: 116, height: 32, backgroundColor: COLORS.border, borderRadius: 8, flexDirection: 'row', alignItems: 'center', padding: 2 }}>
                    <Animated.View style={{
                      position: 'absolute',
                      top: 2,
                      bottom: 2,
                      left: 0,
                      width: 56,
                      backgroundColor: COLORS.whiteCard,
                      borderRadius: 6,
                      transform: [{
                        translateX: langAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [2, 58]
                        })
                      }],
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 2,
                      elevation: 2
                    }} />
                    <TouchableOpacity onPress={() => changeLanguage('en')} style={{ flex: 1, alignItems: 'center', zIndex: 1, height: '100%', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: language === 'en' ? COLORS.primary : COLORS.textMuted }}>EN</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => changeLanguage('fil')} style={{ flex: 1, alignItems: 'center', zIndex: 1, height: '100%', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: language === 'fil' ? COLORS.primary : COLORS.textMuted }}>FIL</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* System Group Card */}
              <Text style={{ color: COLORS.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>
                {t('systemSection')}
              </Text>
              <View style={{ backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, padding: 8, marginBottom: 24 }}>
                {/* Connection Status Row */}
                <View style={{ padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(71, 85, 105, 0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Feather name="activity" size={16} color="#475569" />
                    </View>
                    <Text style={{ color: COLORS.textMain, fontWeight: '600', fontSize: 14 }}>{t('syncStatus')}</Text>
                  </View>
                  <Text style={{ color: isOnline ? COLORS.primary : COLORS.danger, fontWeight: 'bold', fontSize: 13 }}>
                    {isOnline ? t('online') : t('offline')}
                  </Text>
                </View>

                {/* Dark Mode Toggle Row */}
                <View style={{ padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: isDarkMode ? 'rgba(250, 204, 21, 0.15)' : 'rgba(79, 70, 229, 0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Feather name={isDarkMode ? "sun" : "moon"} size={16} color={isDarkMode ? "#eab308" : COLORS.primary} />
                    </View>
                    <Text style={{ color: COLORS.textMain, fontWeight: '600', fontSize: 14 }}>
                      {language === 'fil' ? 'Madilim na Mode' : 'Dark Mode'}
                    </Text>
                  </View>
                  <Switch
                    value={isDarkMode}
                    onValueChange={async (value) => {
                      setIsDarkMode(value);
                      await AsyncStorage.setItem('THEME_MODE', value ? 'dark' : 'light');
                    }}
                    trackColor={{ false: '#cbd5e1', true: '#10b981' }}
                    thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
                  />
                </View>

                {/* Highly Accessible Log Out Row */}
                <TouchableOpacity 
                  onPress={async () => {
                    geofence.reset();
                    setBranchDropdownOpen(false);
                    setShowLeavesModal(false);
                    setShowApplyLeaveModal(false);
                    setShowDisputeModal(false);
                    setSelectedAnnouncement(null);
                    setShowOtModal(false);
                    setShowDtrModal(false);
                    setShowErrorDetails(false);
                    setSession(null); setProfile(null); setSchedules([]); setPayslip(null); setActiveTimeLog(null); setActiveTab('home');
                    try { await supabase.auth.signOut(); } catch(e) {}
                  }}
                  style={{ padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(239, 68, 68, 0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Feather name="log-out" size={16} color={COLORS.danger} />
                    </View>
                    <Text style={{ color: COLORS.danger, fontWeight: 'bold', fontSize: 14 }}>{t('logOut')}</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={COLORS.danger} style={{ opacity: 0.5 }} />
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </FadeInView>

        {/* FIXED BOTTOM NAVIGATION BAR */}
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('home')}>
            <Feather name="home" size={24} color={activeTab === 'home' ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.navText, { color: activeTab === 'home' ? COLORS.primary : COLORS.textMuted }]}>{t('homeTab')}</Text>
            <View style={[styles.navDot, { backgroundColor: activeTab === 'home' ? COLORS.primary : 'transparent' }]} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('schedules')}>
            <Feather name="calendar" size={24} color={activeTab === 'schedules' ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.navText, { color: activeTab === 'schedules' ? COLORS.primary : COLORS.textMuted }]}>{language === 'fil' ? 'Iskedyul' : 'Schedule'}</Text>
            <View style={[styles.navDot, { backgroundColor: activeTab === 'schedules' ? COLORS.primary : 'transparent' }]} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('tickets')}>
            <Feather name="message-square" size={24} color={activeTab === 'tickets' ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.navText, { color: activeTab === 'tickets' ? COLORS.primary : COLORS.textMuted }]}>{t('supportTab')}</Text>
            <View style={[styles.navDot, { backgroundColor: activeTab === 'tickets' ? COLORS.primary : 'transparent' }]} />
          </TouchableOpacity>


          
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('payslip')}>
            <Feather name="dollar-sign" size={24} color={activeTab === 'payslip' ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.navText, { color: activeTab === 'payslip' ? COLORS.primary : COLORS.textMuted }]}>{t('payrollTab')}</Text>
            <View style={[styles.navDot, { backgroundColor: activeTab === 'payslip' ? COLORS.primary : 'transparent' }]} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('profile')}>
            <Feather name="user" size={24} color={activeTab === 'profile' ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.navText, { color: activeTab === 'profile' ? COLORS.primary : COLORS.textMuted }]}>{t('profileTab')}</Text>
            <View style={[styles.navDot, { backgroundColor: activeTab === 'profile' ? COLORS.primary : 'transparent' }]} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  };

  const appContent = renderAppContent();

  const renderedContent = (
    <View style={{ flex: 1, position: 'relative' }}>
      {appContent}

      {showLeavesModal && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.background, zIndex: 99998, padding: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <TouchableOpacity onPress={() => setShowLeavesModal(false)} style={{ padding: 8, marginLeft: -8 }}>
              <Feather name="arrow-left" size={24} color={COLORS.textMain} />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.textMain }}>{language === 'fil' ? 'Kasaysayan ng Leave' : 'Leave Requests'}</Text>
            <TouchableOpacity onPress={fetchLeaves} style={{ padding: 8, marginRight: -8 }} disabled={leavesLoading}>
              {leavesLoading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Feather name="refresh-cw" size={18} color={COLORS.primary} />}
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            onPress={() => setShowApplyLeaveModal(true)}
            style={{ backgroundColor: COLORS.primary, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}
          >
            <Text style={{ color: COLORS.background, fontSize: 14, fontWeight: 'bold' }}>{language === 'fil' ? 'Mag-file ng Bagong Leave' : 'File New Leave Request'}</Text>
          </TouchableOpacity>

          {leavesLoading && leaves.length === 0 ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
          ) : leaves.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 }}>
              <Feather name="calendar" size={48} color={COLORS.border} style={{ marginBottom: 16 }} />
              <Text style={{ color: COLORS.textMuted, fontStyle: 'italic' }}>{language === 'fil' ? 'Walang nahanap na mga leave request.' : 'No leave requests found.'}</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
              {leaves.map((item) => {
                const startStr = new Date(item.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                const endStr = new Date(item.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                
                let badgeColor = '#f59e0b'; // pending
                if (item.status === 'approved') badgeColor = COLORS.primary;
                if (item.status === 'rejected') badgeColor = COLORS.danger;

                return (
                  <View key={item.id} style={{ backgroundColor: COLORS.card, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.primary, textTransform: 'uppercase' }}>
                        {item.leave_type}
                      </Text>
                      <View style={{ backgroundColor: badgeColor + '15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ fontSize: 10, color: badgeColor, fontWeight: '800', textTransform: 'uppercase' }}>
                          {item.status}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 4 }}>
                      📅 {startStr} - {endStr}
                    </Text>
                    <Text style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 8 }}>
                      {item.reason}
                    </Text>
                    {item.attachment_url && (
                      <TouchableOpacity 
                        onPress={() => Linking.openURL(item.attachment_url)}
                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.border, padding: 8, borderRadius: 8, alignSelf: 'flex-start' }}
                      >
                        <Feather name="file" size={14} color={COLORS.textMain} style={{ marginRight: 6 }} />
                        <Text style={{ fontSize: 11, color: COLORS.textMain, fontWeight: 'bold' }}>{language === 'fil' ? 'Tingnan ang Attachment' : 'View Attachment'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {showApplyLeaveModal && (
        <Modal animationType="slide" transparent={false} visible={showApplyLeaveModal} onRequestClose={() => setShowApplyLeaveModal(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background, padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 10 }}>
              <TouchableOpacity onPress={() => setShowApplyLeaveModal(false)} style={{ padding: 8, marginLeft: -8 }}>
                <Feather name="x" size={24} color={COLORS.textMain} />
              </TouchableOpacity>
              <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.textMain }}>{language === 'fil' ? 'Mag-apply para sa Leave' : 'Apply for Leave'}</Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 40 }}>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 6 }}>{language === 'fil' ? 'Uri ng Leave' : 'Leave Type'}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {(['sick', 'vacation', 'emergency', 'unpaid'] as const).map((type) => (
                  <TouchableOpacity 
                    key={type}
                    onPress={() => setLeaveType(type)}
                    style={{ 
                      flex: 1, 
                      padding: 10, 
                      borderRadius: 10, 
                      borderWidth: 1, 
                      borderColor: leaveType === type ? COLORS.primary : COLORS.border,
                      backgroundColor: leaveType === type ? COLORS.primaryDim : 'transparent',
                      alignItems: 'center'
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: leaveType === type ? COLORS.primary : COLORS.textMuted, textTransform: 'uppercase' }}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 6 }}>{language === 'fil' ? 'Simulang Petsa (YYYY-MM-DD)' : 'Start Date (YYYY-MM-DD)'}</Text>
              <TextInput 
                style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, fontSize: 14, color: COLORS.textMain, marginBottom: 16, backgroundColor: COLORS.card }}
                placeholder="e.g. 2026-07-20"
                placeholderTextColor={COLORS.textMuted}
                value={leaveStartDate}
                onChangeText={setLeaveStartDate}
              />

              <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 6 }}>{language === 'fil' ? 'Katapusang Petsa (YYYY-MM-DD)' : 'End Date (YYYY-MM-DD)'}</Text>
              <TextInput 
                style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, fontSize: 14, color: COLORS.textMain, marginBottom: 16, backgroundColor: COLORS.card }}
                placeholder="e.g. 2026-07-22"
                placeholderTextColor={COLORS.textMuted}
                value={leaveEndDate}
                onChangeText={setLeaveEndDate}
              />

              <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 6 }}>{language === 'fil' ? 'Dahilan' : 'Reason'}</Text>
              <TextInput 
                style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, fontSize: 14, color: COLORS.textMain, marginBottom: 16, backgroundColor: COLORS.card, height: 100 }}
                placeholder="Reason for leave request"
                placeholderTextColor={COLORS.textMuted}
                value={leaveReason}
                onChangeText={setLeaveReason}
                multiline
              />

              <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 6 }}>{language === 'fil' ? 'Attachment (Kailangan)' : 'Attachment (Required)'}</Text>
              <TouchableOpacity 
                onPress={handleSelectLeaveAttachment}
                style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  borderWidth: 1, 
                  borderColor: COLORS.border, 
                  borderStyle: 'dashed', 
                  borderRadius: 12, 
                  padding: 16, 
                  backgroundColor: COLORS.card,
                  justifyContent: 'center',
                  marginBottom: 24 
                }}
              >
                <Feather name="paperclip" size={16} color={COLORS.textMuted} style={{ marginRight: 8 }} />
                <Text style={{ color: COLORS.textMuted, fontSize: 13, fontWeight: '600' }}>
                  {leaveAttachment ? leaveAttachment.name : (language === 'fil' ? 'Pumili ng Larawan o PDF' : 'Choose Photo or PDF')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={handleApplyLeaveSubmit}
                disabled={leaveSubmitLoading}
                style={{ backgroundColor: COLORS.primary, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
              >
                {leaveSubmitLoading ? <ActivityIndicator color={COLORS.background} size="small" /> : <Text style={{ color: COLORS.background, fontSize: 14, fontWeight: 'bold' }}>{language === 'fil' ? 'I-submit ang Application' : 'Submit Leave Request'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}

      {showOtModal && (
        <Modal animationType="slide" transparent={false} visible={showOtModal} onRequestClose={() => setShowOtModal(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background, padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 10 }}>
              <TouchableOpacity onPress={() => setShowOtModal(false)} style={{ padding: 8, marginLeft: -8 }}>
                <Feather name="x" size={24} color={COLORS.textMain} />
              </TouchableOpacity>
              <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.textMain }}>
                {language === 'fil' ? 'Mag-request ng Overtime' : 'Request Overtime'}
              </Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 40 }}>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 12 }}>
                {language === 'fil'
                  ? 'Gamitin ang form na ito upang mag-request ng overtime hours kapag nagtatrabaho lagpas ng 5:00 PM.'
                  : 'Use this form to request overtime hours when working past 5:00 PM.'}
              </Text>

              <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 6 }}>
                {language === 'fil' ? 'Petsa ng Overtime' : 'Overtime Date'}
              </Text>
              <TextInput 
                style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, fontSize: 14, color: COLORS.textMuted, marginBottom: 16, backgroundColor: COLORS.card }}
                value={new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}
                editable={false}
              />

              <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 6 }}>
                {language === 'fil' ? 'Bilang ng Oras (OT Hours)' : 'Requested Hours (OT Hours)'}
              </Text>
              <TextInput 
                style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, fontSize: 14, color: COLORS.textMain, marginBottom: 16, backgroundColor: COLORS.card }}
                keyboardType="numeric"
                placeholder="e.g. 2"
                placeholderTextColor={COLORS.textMuted}
                value={otHours}
                onChangeText={setOtHours}
              />

              <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 6 }}>
                {language === 'fil' ? 'Dahilan ng Overtime' : 'Reason for Overtime'}
              </Text>
              <TextInput 
                style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, fontSize: 14, color: COLORS.textMain, marginBottom: 24, backgroundColor: COLORS.card, height: 120 }}
                placeholder={language === 'fil' ? 'Ilagay ang dahilan ng pag-overtime...' : 'Explain the reason for overtime...'}
                placeholderTextColor={COLORS.textMuted}
                value={otReason}
                onChangeText={setOtReason}
                multiline
              />

              <TouchableOpacity 
                onPress={handleOtSubmit}
                disabled={otSubmitting}
                style={{ backgroundColor: COLORS.primary, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
              >
                {otSubmitting ? (
                  <ActivityIndicator color={COLORS.background} size="small" />
                ) : (
                  <Text style={{ color: COLORS.background, fontSize: 14, fontWeight: 'bold' }}>
                    {language === 'fil' ? 'I-submit ang OT Request' : 'Submit OT Request'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}

      
      {showPayslipDetailsModal && payslip && (
        <Modal animationType="slide" transparent={false} visible={showPayslipDetailsModal} onRequestClose={() => setShowPayslipDetailsModal(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: COLORS.background, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
              <TouchableOpacity onPress={() => setShowPayslipDetailsModal(false)} style={{ padding: 8, marginLeft: -8 }}>
                <Feather name="arrow-left" size={24} color={COLORS.textMain} />
              </TouchableOpacity>
              <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.textMain }}>{language === 'fil' ? 'Detalye ng Payslip' : 'Payslip Details'}</Text>
              <View style={{ width: 40 }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <View style={styles.payslipCard}>
                <Text style={styles.sectionTitle}>{language === 'fil' ? 'Huling Payslip' : 'Payslip Record'}</Text>
                <Text style={styles.period}>{language === 'fil' ? 'Siklo' : 'Cycle'}: {payslip.period_start} to {payslip.period_end}</Text>
                
                <View style={styles.netPayBox}>
                  <Text style={styles.netPayLabel}>{language === 'fil' ? 'Kabuuang Netong Sahod' : 'Net Take-Home Pay'}</Text>
                  <Text style={styles.netPayAmount}>{formatPhp(payslip.net_pay)}</Text>
                </View>

                <Text style={{ color: COLORS.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginTop: 8 }}>
                  {language === 'fil' ? 'PAGHAHATI-HATI NG KITA' : 'EARNINGS BREAKDOWN'}
                </Text>
                
                <View style={{ backgroundColor: COLORS.card, borderRadius: 16, borderLeftWidth: 0, borderRightWidth: 0, borderWidth: 1, borderColor: COLORS.border, padding: 12, marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                    <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>{language === 'fil' ? 'Base Regular Pay' : 'Base Regular Pay'}</Text>
                    <Text style={{ color: COLORS.textMain, fontWeight: '600', fontSize: 13 }}>{formatPhp(Math.min(Number(payslip.gross_pay), (Number(profile?.base_salary || 20000) / 208) * 80))}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                    <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>{language === 'fil' ? 'Oras ng Holiday at Bonus' : 'Holiday Hours & Multiplier'}</Text>
                    <Text style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: 13 }}>+{formatPhp(Math.max(0, Number(payslip.gross_pay) - ((Number(profile?.base_salary || 20000) / 208) * 80)))}</Text>
                  </View>
                </View>

                <Text style={{ color: COLORS.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                  {language === 'fil' ? 'MGA BINAWAS (DEDUCTIONS)' : 'DEDUCTIONS & ADJUSTMENTS'}
                </Text>

                <View style={{ backgroundColor: COLORS.card, borderRadius: 16, borderLeftWidth: 0, borderRightWidth: 0, borderWidth: 1, borderColor: COLORS.border, padding: 12, marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                    <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>SSS Contribution</Text>
                    <Text style={{ color: COLORS.danger, fontWeight: 'bold', fontSize: 13 }}>- {formatPhp(payslip.sss_deduction)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                    <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>PhilHealth Contribution</Text>
                    <Text style={{ color: COLORS.danger, fontWeight: 'bold', fontSize: 13 }}>- {formatPhp(payslip.philhealth_deduction)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                    <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>Pag-IBIG Contribution</Text>
                    <Text style={{ color: COLORS.danger, fontWeight: 'bold', fontSize: 13 }}>- {formatPhp(payslip.pagibig_deduction)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                    <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>{language === 'fil' ? 'Withholding Tax / Karagdagang Bawas' : 'Withholding Tax adjustments'}</Text>
                    <Text style={{ color: COLORS.danger, fontWeight: 'bold', fontSize: 13 }}>- {formatPhp(Math.max(0, Number(payslip.gross_pay) - Number(payslip.sss_deduction) - Number(payslip.philhealth_deduction) - Number(payslip.pagibig_deduction) - Number(payslip.net_pay)))}</Text>
                  </View>
                </View>

                <TouchableOpacity 
                  onPress={() => {
                      setShowPayslipDetailsModal(false);
                      setTimeout(() => setShowDisputeModal(true), 300);
                  }}
                  style={{ backgroundColor: COLORS.danger, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 24, marginBottom: 12 }}
                >
                  <Text style={{ color: COLORS.background, fontSize: 14, fontWeight: 'bold' }}>
                    {language === 'fil' ? 'I-dispute ang Payslip' : 'Dispute Payslip'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}

      {showDisputeModal && (
        <Modal animationType="slide" transparent={false} visible={showDisputeModal} onRequestClose={() => setShowDisputeModal(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff', padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 10 }}>
              <TouchableOpacity onPress={() => setShowDisputeModal(false)} style={{ padding: 8, marginLeft: -8 }}>
                <Feather name="x" size={24} color={COLORS.textMain} />
              </TouchableOpacity>
              <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.textMain }}>{language === 'fil' ? 'I-dispute ang Payslip' : 'Dispute Payslip'}</Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 40 }}>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 8 }}>
                {language === 'fil' ? 'Siklo ng Payslip' : 'Payslip Cycle'}: {payslip?.period_start ? new Date(payslip.period_start).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''} to {payslip?.period_end ? new Date(payslip.period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
              </Text>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 8 }}>
                {language === 'fil' ? 'Kabuuang Netong Sahod' : 'Net Take-Home Pay'}: {formatPhp(payslip?.net_pay)}
              </Text>

              <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 16 }} />

              <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 6 }}>
                {language === 'fil' ? 'Dahilan ng Dispute (e.g. kulang ang overtime or holiday pay)' : 'Reason for Dispute (e.g. missing hours or allowances)'}
              </Text>
              <TextInput 
                style={{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, fontSize: 14, color: COLORS.textMain, marginBottom: 16, backgroundColor: COLORS.card, height: 120 }}
                placeholder="State the reason why you are disputing this payslip..."
                placeholderTextColor={COLORS.textMuted}
                value={disputeReason}
                onChangeText={setDisputeReason}
                multiline
              />

              <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 6 }}>
                {language === 'fil' ? 'Supporting Document / Patunay (Kailangan)' : 'Supporting Document (Required)'}
              </Text>
              <TouchableOpacity 
                onPress={handleSelectDisputeAttachment}
                style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  borderWidth: 1, 
                  borderColor: COLORS.border, 
                  borderStyle: 'dashed', 
                  borderRadius: 12, 
                  padding: 16, 
                  backgroundColor: COLORS.card,
                  justifyContent: 'center',
                  marginBottom: 24 
                }}
              >
                <Feather name="paperclip" size={16} color={COLORS.textMuted} style={{ marginRight: 8 }} />
                <Text style={{ color: COLORS.textMuted, fontSize: 13, fontWeight: '600' }}>
                  {disputeAttachment ? disputeAttachment.name : (language === 'fil' ? 'Pumili ng Larawan o PDF' : 'Choose Photo or PDF')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={handleApplyDisputeSubmit}
                disabled={disputeSubmitLoading}
                style={{ backgroundColor: COLORS.danger, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
              >
                {disputeSubmitLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>{language === 'fil' ? 'I-submit ang Dispute' : 'Submit Dispute'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}

      {showDtrModal && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.background, zIndex: 99998, padding: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <TouchableOpacity onPress={() => setShowDtrModal(false)} style={{ padding: 8, marginLeft: -8 }}>
              <Feather name="arrow-left" size={24} color={COLORS.textMain} />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.textMain }}>{t('dtrHistoryTitle')}</Text>
            <TouchableOpacity onPress={fetchDtrLogs} style={{ padding: 8, marginRight: -8 }} disabled={dtrLoading}>
              {dtrLoading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Feather name="refresh-cw" size={18} color={COLORS.primary} />}
            </TouchableOpacity>
          </View>
          
          <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            {t('currentMonthLogs')} ({dtrLogs.length})
          </Text>

          {dtrLogs.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 }}>
              <Feather name="clock" size={48} color={COLORS.border} style={{ marginBottom: 16 }} />
              <Text style={{ color: COLORS.textMuted, fontStyle: 'italic' }}>
                {dtrLoading ? t('loadingLogs') : t('noLogs')}
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
              {dtrLogs.map((log) => {
                const logDate = new Date(log.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                const timeInStr = log.app_time_in ? formatTime(log.app_time_in) : '--:--';
                const timeOutStr = log.app_time_out ? formatTime(log.app_time_out) : '--:--';
                const hours = log.total_hours !== null ? `${log.total_hours} hrs` : t('active');
                const isManual = log.is_manual_entry || log.geofence_status === 'manual_override';

                return (
                  <View key={log.id} style={{ backgroundColor: COLORS.card, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: COLORS.textMain }}>📅 {logDate}</Text>
                      {isManual ? (
                        <View style={{ backgroundColor: '#e2e8f0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 10, color: '#475569', fontWeight: '800' }}>{t('manualEntry')}</Text>
                        </View>
                      ) : (
                        <View style={{ backgroundColor: COLORS.primaryDim, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 10, color: COLORS.primary, fontWeight: '800' }}>{t('gpsVerified')}</Text>
                        </View>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase' }}>{t('clockIn')}</Text>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.textMain, marginTop: 2 }}>{timeInStr}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase' }}>{t('clockOut')}</Text>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.textMain, marginTop: 2 }}>{timeOutStr}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', flex: 1 }}>
                        <Text style={{ fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase' }}>{t('duration')}</Text>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.primary, marginTop: 2 }}>{hours}</Text>
                      </View>
                    </View>
                    
                    {log.gps_accuracy && !isManual && (
                      <Text style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 8 }}>
                        📍 {t('accuracy')}: {log.gps_accuracy.toFixed(1)}m {log.is_mocked ? ` | ⚠️ ${t('mockGps')}` : ''}
                      </Text>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}
      {splashVisible && (
        <Animated.View style={[styles.splashContainer, { opacity: splashOpacity }]} pointerEvents={splashVisible ? 'auto' : 'none'}>
          <Animated.View style={{ transform: [{ scale: logoScale }], opacity: logoOpacity, alignItems: 'center' }}>
            <Image source={require('../../assets/technocycle_logo.png')} style={styles.splashLogo} />
            <Animated.View style={{ opacity: taglineOpacity, transform: [{ translateY: taglineTranslateY }], alignItems: 'center' }}>
              <Text style={styles.splashBrand}>TECHNOSYS</Text>
              <Text style={styles.splashSubBrand}>Secure Field System</Text>
              <View style={styles.splashIndicatorContainer}>
                <ActivityIndicator color={COLORS.primary} size="small" />
              </View>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      )}

      {activeAlert && (() => {
        const { icon, color } = getAlertIconAndColor(activeAlert.title, activeAlert.message || '');
        const alertButtons = activeAlert.buttons || [{ text: 'OK', onPress: () => {} }];
        
        return (
          <Modal
            visible={!!activeAlert}
            transparent
            animationType="fade"
            onRequestClose={() => handleAlertDismiss()}
          >
            <View style={{
              flex: 1,
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 20
            }}>
              <View style={{
                backgroundColor: COLORS.card,
                borderRadius: 24,
                width: '88%',
                maxWidth: 340,
                padding: 24,
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.25,
                shadowRadius: 20,
                elevation: 10,
                borderWidth: 1,
                borderColor: COLORS.border
              }}>
                {/* Icon Container */}
                <View style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: color + '15',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 16
                }}>
                  <Feather name={icon} size={28} color={color} />
                </View>

                {/* Title */}
                <Text style={{
                  fontSize: 18,
                  fontWeight: '800',
                  color: COLORS.textMain,
                  textAlign: 'center',
                  marginBottom: 8
                }}>
                  {activeAlert.title}
                </Text>

                {/* Message */}
                {activeAlert.message ? (
                  <Text style={{
                    fontSize: 14,
                    color: COLORS.textMuted,
                    textAlign: 'center',
                    lineHeight: 20,
                    marginBottom: 24
                  }}>
                    {activeAlert.message}
                  </Text>
                ) : (
                  <View style={{ height: 16 }} />
                )}

                {/* Collapsible Details Panel */}
                {activeAlert.rawMessage && (
                  <View style={{ width: '100%', marginBottom: 16 }}>
                    <TouchableOpacity
                      onPress={() => setShowErrorDetails(prev => !prev)}
                      activeOpacity={0.7}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 8,
                        backgroundColor: COLORS.background,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: COLORS.border
                      }}
                    >
                      <Feather 
                        name={showErrorDetails ? "chevron-up" : "chevron-down"} 
                        size={16} 
                        color={COLORS.textMuted} 
                        style={{ marginRight: 6 }} 
                      />
                      <Text style={{ fontSize: 12, color: COLORS.textMuted, fontWeight: '700' }}>
                        {showErrorDetails 
                          ? (language === 'fil' ? 'Itago ang Detalye' : 'Hide Details') 
                          : (language === 'fil' ? 'Ipakita ang Detalye' : 'Show Details')}
                      </Text>
                    </TouchableOpacity>
                    
                    {showErrorDetails && (
                      <View style={{
                        marginTop: 8,
                        padding: 12,
                        backgroundColor: '#0f172a',
                        borderRadius: 10,
                        maxHeight: 120,
                        width: '100%'
                      }}>
                        <ScrollView style={{ flexGrow: 0 }}>
                          <Text style={{
                            fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                            fontSize: 11,
                            color: '#94a3b8',
                            lineHeight: 16
                          }}>
                            {activeAlert.rawMessage}
                          </Text>
                        </ScrollView>
                      </View>
                    )}
                  </View>
                )}

                {/* Buttons Container */}
                <View style={{ width: '100%' }}>
                  {alertButtons.map((btn, idx) => {
                    const isCancel = btn.style === 'cancel' || btn.text?.toLowerCase() === 'cancel' || btn.text?.toLowerCase() === 'itigil';
                    const isDestructive = btn.style === 'destructive';
                    
                    return (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => handleAlertDismiss(btn.onPress)}
                        activeOpacity={0.7}
                        style={{
                          width: '100%',
                          height: 48,
                          borderRadius: 14,
                          backgroundColor: isCancel 
                            ? 'transparent' 
                            : isDestructive 
                              ? '#ef4444' 
                              : color,
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginTop: idx > 0 ? 8 : 0
                        }}
                      >
                        <Text style={{
                          color: isCancel ? COLORS.textMuted : '#ffffff',
                          fontSize: 15,
                          fontWeight: '700'
                        }}>
                          {btn.text || 'OK'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </Modal>
        );
      })()}

      {selectedAnnouncement && (
        <Modal 
          animationType="fade" 
          transparent={true} 
          visible={!!selectedAnnouncement} 
          onRequestClose={() => setSelectedAnnouncement(null)}
        >
          <TouchableOpacity 
            style={{ 
              flex: 1, 
              backgroundColor: 'rgba(15, 23, 42, 0.65)', 
              justifyContent: 'center', 
              alignItems: 'center', 
              padding: 20 
            }} 
            activeOpacity={1} 
            onPress={() => setSelectedAnnouncement(null)}
          >
            <TouchableOpacity 
              activeOpacity={1} 
              onPress={(e) => e.stopPropagation()} 
              style={{ 
                width: '100%', 
                maxWidth: 420, 
                maxHeight: '80%', 
                backgroundColor: COLORS.card, 
                borderRadius: 24, 
                borderWidth: 1, 
                borderColor: COLORS.border, 
                shadowColor: '#000', 
                shadowOffset: { width: 0, height: 10 }, 
                shadowOpacity: 0.25, 
                shadowRadius: 20, 
                elevation: 12, 
                overflow: 'hidden' 
              }}
            >
              {/* Modal Header */}
              <View style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                paddingHorizontal: 20, 
                paddingVertical: 16, 
                borderBottomWidth: 1, 
                borderBottomColor: COLORS.border,
                backgroundColor: COLORS.card
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(99, 102, 241, 0.12)', alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="bell" size={16} color="#6366f1" />
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.textMain }}>
                    {language === 'fil' ? 'Anunsyo' : 'Announcement'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedAnnouncement(null)} style={{ padding: 6, borderRadius: 12, backgroundColor: COLORS.border }}>
                  <Feather name="x" size={18} color={COLORS.textMain} />
                </TouchableOpacity>
              </View>

              {/* Scrollable Body */}
              <ScrollView contentContainerStyle={{ padding: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <View style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#6366f1', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      📢 {selectedAnnouncement.target_branch_id ? (language === 'fil' ? 'Sangay' : 'Branch') : 'Global'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: '500' }}>
                    {new Date(selectedAnnouncement.created_at).toLocaleDateString(language === 'fil' ? 'fil-PH' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>

                <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.textMain, marginBottom: 14, lineHeight: 24 }}>
                  {getBilingualText(selectedAnnouncement.title, language)}
                </Text>

                <View style={{ height: 1, backgroundColor: COLORS.border, marginBottom: 16 }} />

                <Text style={{ fontSize: 14, color: COLORS.textMain, lineHeight: 22 }}>
                  {getBilingualText(selectedAnnouncement.content, language)}
                </Text>
              </ScrollView>

              {/* Footer */}
              <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.card }}>
                <TouchableOpacity 
                  onPress={() => setSelectedAnnouncement(null)} 
                  style={{ 
                    backgroundColor: COLORS.primary, 
                    paddingVertical: 12, 
                    borderRadius: 14, 
                    alignItems: 'center' 
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                    {language === 'fil' ? 'Isara' : 'Close'}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );

  const showSimulatorFrame = Platform.OS === 'web' && width > 480;
  if (showSimulatorFrame) {
    return (
      <View style={styles.webContainer}>
        <View style={styles.phoneFrame}>
          {/* Status Bar / Notch Simulation */}
          <View style={styles.phoneNotch} />
          {/* Inner Screen */}
          <View style={styles.phoneScreen}>
            {renderedContent}
          </View>
          {/* Home Indicator Simulation */}
          <View style={styles.phoneHomeBar} />
        </View>
      </View>
    );
  }

  return renderedContent;
}

function getStyles(COLORS: any) { return StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background, height: '100%' },
  container: { flex: 1, backgroundColor: COLORS.background, height: '100%' },
  content: { padding: 24, paddingBottom: 40 },
  header: { marginBottom: 32, marginTop: 12 },
  greeting: { color: COLORS.textMuted, fontSize: 16, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  name: { color: COLORS.textMain, fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  input: { backgroundColor: COLORS.card, color: COLORS.textMain, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  
  timeInButton: { backgroundColor: COLORS.primary, padding: 24, borderRadius: 20, alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16 },
  timeInSuccess: { backgroundColor: COLORS.primaryDim, padding: 24, borderRadius: 20, alignItems: 'center', borderColor: COLORS.primary, borderWidth: 1 },
  
  readyCard: {
    backgroundColor: COLORS.isDarkMode ? 'rgba(16, 185, 129, 0.12)' : '#f0fdf4',
    borderColor: COLORS.isDarkMode ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: COLORS.isDarkMode ? 0.2 : 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  scanningCard: {
    backgroundColor: COLORS.whiteCard,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  activeCard: {
    backgroundColor: COLORS.whiteCard,
    borderColor: 'transparent',
    borderWidth: 2,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  completedCard: {
    backgroundColor: '#f1f5f9',
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  cancelScanButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.whiteCard,
    marginTop: 8,
  },
  timeOutSecondaryButton: {
    backgroundColor: COLORS.danger,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },

  dispatchCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  dispatchBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dispatchBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  attendanceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: COLORS.isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.05)',
    borderWidth: 1,
    borderColor: COLORS.isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.1)',
  },
  attendanceBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: COLORS.isDarkMode ? '#94a3b8' : '#475569',
  },
  dispatchTitle: {
    color: COLORS.textMain,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  dispatchTime: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginBottom: 12,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.whiteCard,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  directionsButtonText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.03)',
    borderRadius: 8,
  },
  emptyCard: {
    backgroundColor: COLORS.whiteCard,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  
  payslipCard: { backgroundColor: COLORS.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: COLORS.border },
  sectionTitle: { color: COLORS.textMain, fontSize: 20, fontWeight: '800', marginBottom: 4, letterSpacing: -0.5 },
  period: { color: COLORS.textMuted, fontSize: 14, marginBottom: 20 },
  netPayBox: { backgroundColor: COLORS.primary, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 24, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
  netPayLabel: { color: '#ecfdf5', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 1 },
  netPayAmount: { color: '#fff', fontSize: 32, fontWeight: '800' },
  divider: { height: 1, backgroundColor: COLORS.border, marginBottom: 20 },
  deductionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  deductionLabel: { color: COLORS.textMuted, fontSize: 15 },
  grossAmount: { color: COLORS.textMain, fontSize: 15, fontWeight: 'bold' },
  deductionAmount: { color: COLORS.danger, fontSize: 15, fontWeight: 'bold' },
 
  sectionTitleMain: { color: COLORS.textMain, fontSize: 14, fontWeight: '800', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 },

  bottomNav: { flexDirection: 'row', backgroundColor: COLORS.card, paddingBottom: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.border, justifyContent: 'space-around' },
  navItem: { alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  navDot: { width: 4, height: 4, borderRadius: 2, marginTop: 4 },
  splashContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200000,
  } as ViewStyle,
  splashLogo: {
    width: 110,
    height: 110,
    resizeMode: 'contain',
    marginBottom: 20,
  },
  splashBrand: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 6,
    marginBottom: 6,
  } as TextStyle,
  splashSubBrand: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 3,
    textTransform: 'uppercase',
  } as TextStyle,
  splashIndicatorContainer: {
    marginTop: 40,
    height: 20,
  } as ViewStyle,
  offlineBanner: {
    backgroundColor: '#f43f5e',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    zIndex: 99
  } as ViewStyle,
  offlineBannerText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  } as TextStyle,
  webContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    paddingVertical: 40
  } as ViewStyle,
  phoneFrame: {
    width: 390,
    height: 844,
    backgroundColor: COLORS.background,
    borderRadius: 44,
    borderWidth: 12,
    borderColor: '#1e293b',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 8
  } as ViewStyle,
  phoneNotch: {
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: [{ translateX: -75 }] as any,
    width: 150,
    height: 30,
    backgroundColor: '#1e293b',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    zIndex: 99999
  } as ViewStyle,
  phoneScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
    height: '100%',
    width: '100%'
  } as ViewStyle,
  phoneHomeBar: {
    position: 'absolute',
    bottom: 8,
    left: '50%',
    transform: [{ translateX: -60 }] as any,
    width: 120,
    height: 5,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    zIndex: 99999
  } as ViewStyle
}); }
