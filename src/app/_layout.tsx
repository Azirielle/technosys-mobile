import { Slot, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CopilotProvider } from 'react-native-copilot';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { BackHandler, Alert, LogBox } from 'react-native';
import { useFonts, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import * as SplashScreen from 'expo-splash-screen';
import { supabase } from '../lib/supabase';
import AnimatedSplashScreen from '../components/AnimatedSplashScreen';

SplashScreen.preventAutoHideAsync();
LogBox.ignoreLogs(['Accessing element.ref was removed']);

export default function RootLayout() {
  const router = useRouter();
  const [showSplashOverlay, setShowSplashOverlay] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    'DMSans-Regular': DMSans_400Regular,
    'DMSans-Medium': DMSans_500Medium,
    'DMSans-Bold': DMSans_700Bold,
  });

  useEffect(() => {
    supabase.auth.getSession().then(() => {
      setAuthReady(true);
    }).catch(() => {
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      // Hide native OS splash so the Reanimated hero splash seamlessly takes over
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // Safety fallback timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplashOverlay(false);
      SplashScreen.hideAsync().catch(() => {});
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onBackPress = () => {
      if (router.canGoBack()) {
        router.back();
        return true;
      } else {
        // At root (Home or Login)
        Alert.alert('Exit App', 'Are you sure you want to exit TechnoCycle?', [
          {
            text: 'Cancel',
            onPress: () => null,
            style: 'cancel',
          },
          { text: 'YES', onPress: () => BackHandler.exitApp() },
        ]);
        return true;
      }
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [router]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <CopilotProvider tooltipStyle={{ backgroundColor: '#ffffff', borderRadius: 16 }} stepNumberComponent={() => null}>
        <Slot />
      </CopilotProvider>

      {showSplashOverlay && (
        <AnimatedSplashScreen
          isReady={authReady}
          onAnimationComplete={() => setShowSplashOverlay(false)}
        />
      )}
    </SafeAreaProvider>
  );
}
