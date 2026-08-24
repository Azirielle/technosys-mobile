import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, StatusBar, TextInput, Alert, ActivityIndicator, Image, Animated, Platform, ViewStyle, TextStyle, Linking, useWindowDimensions, Modal, Keyboard, BackHandler, Switch } from 'react-native';
import * as ExpoCrypto from 'expo-crypto';
import * as Device from 'expo-device';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useTabTutorial } from '../hooks/useTabTutorial';
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
  useTabTutorial('HOME');
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
              { text: language === 'fil' ? 'Simulan' : 'Start Tour', onPress: () => { AsyncStorage.setItem('COPILOT_NEVER_SHOW', 'true'); setTimeout(() => startCopilot(), 500); } },
              { text: language === 'fil' ? 'Laktawan' : 'Skip', style: 'cancel', onPress: () => AsyncStorage.setItem('COPILOT_NEVER_SHOW', 'true') },
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
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    const showSizeError = () => {
      Alert.alert(
        language === 'fil' ? 'Masyadong Malaki ang File' : 'File Size Limit Exceeded',
        language === 'fil'
          ? 'Ang maximum file size limit ay 10 MB. Mangyaring pumili ng mas maliit na file.'
          : 'Maximum allowed file size is 10 MB. Please select a smaller file.'
      );
    };

    if (Platform.OS === 'web') {
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['image/*', 'application/pdf'],
          copyToCacheDirectory: true
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          if (asset.size && asset.size > MAX_FILE_SIZE) {
            showSizeError();
            return;
          }
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
        'Attach Document (Max 10 MB)',
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
                if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) {
                  showSizeError();
                  return;
                }
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
                if (asset.size && asset.size > MAX_FILE_SIZE) {
                  showSizeError();
                  return;
                }
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
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    const showSizeError = () => {
      Alert.alert(
        language === 'fil' ? 'Masyadong Malaki ang File' : 'File Size Limit Exceeded',
        language === 'fil'
          ? 'Ang maximum file size limit ay 10 MB. Mangyaring pumili ng mas maliit na file.'
          : 'Maximum allowed file size is 10 MB. Please select a smaller file.'
      );
    };

    if (Platform.OS === 'web') {
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['image/*', 'application/pdf'],
          copyToCacheDirectory: true
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          if (asset.size && asset.size > MAX_FILE_SIZE) {
            showSizeError();
            return;
          }
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
        'Attach Supporting Document (Max 10 MB)',
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
                if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) {
                  showSizeError();
                  return;
                }
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
                if (asset.size && asset.size > MAX_FILE_SIZE) {
                  showSizeError();
                  return;
                }
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
      const actionUptime = await Device.getUptimeAsync();
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
          const signature = await ExpoCrypto.digestStringAsync(
            ExpoCrypto.CryptoDigestAlgorithm.SHA256,
            `${session.user.id}:${actionUptime}:TECHNO_SECRET_SALT`
          );
          const queuePayload = {
            ...timeInPayload,
            time_drift_at_creation: locationResult.timeDrift || null,
            uptime_at_creation: actionUptime,
            signature: signature
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
      const actionUptime = await Device.getUptimeAsync();
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
          const signature = await ExpoCrypto.digestStringAsync(
            ExpoCrypto.CryptoDigestAlgorithm.SHA256,
            `${session.user.id}:${actionUptime}:TECHNO_SECRET_SALT`
          );
          await syncQueue.addToQueue('time_out', {
            log_id: activeTimeLog.id,
            technician_id: session.user.id,
            app_time_out: timeOutTime,
            total_hours: diffHours,
            is_suspicious: isSuspicious,
            time_drift_at_creation: locationResult?.timeDrift || null,
            uptime_at_creation: actionUptime,
            signature: signature
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
        router.replace('/(tabs)');
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace('/(tabs)');
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

