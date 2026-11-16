import { Stack, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CopilotProvider } from 'react-native-copilot';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { BackHandler, Alert, LogBox } from 'react-native';
import { useFonts, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, useAppTheme } from '../context/ThemeContext';
import { loadHapticsSetting } from '../lib/hapticsSetting';

SplashScreen.preventAutoHideAsync();
LogBox.ignoreLogs(['Accessing element.ref was removed']);

function RootStatusBar() {
  const { isDark } = useAppTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  const router = useRouter();

  const [fontsLoaded, fontError] = useFonts({
    'DMSans-Regular': DMSans_400Regular,
    'DMSans-Medium': DMSans_500Medium,
    'DMSans-Bold': DMSans_700Bold,
    // The app's font (docs/ui-library/type-and-layout.md). DM Sans stays until every old screen is redone.
    'Jakarta-Regular': PlusJakartaSans_400Regular,
    'Jakarta-SemiBold': PlusJakartaSans_600SemiBold,
    'Jakarta-Bold': PlusJakartaSans_700Bold,
  });

  // "Vibrate on tap" (Profile) is read before any button can buzz
  useEffect(() => { loadHapticsSetting(); }, []);

  // Safety fallback timeout to ensure native splash never freezes
  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 3500);
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
    <ThemeProvider>
      <SafeAreaProvider>
        <RootStatusBar />
        <CopilotProvider tooltipStyle={{ backgroundColor: '#ffffff', borderRadius: 16 }} stepNumberComponent={() => null}>
          {/* A real stack: screens opened from a tab (handbook, a DTR day) slide in on top, and Back returns to that tab.
              'ios_from_right' is the smooth native slide (the screen underneath moves a little too), on Android as well. */}
          <Stack screenOptions={{ headerShown: false, animation: 'ios_from_right', gestureEnabled: true }}>
            <Stack.Screen name="index" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="setup" options={{ animation: 'fade' }} />
          </Stack>
        </CopilotProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
