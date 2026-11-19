import { Stack, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CopilotProvider } from 'react-native-copilot';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { BackHandler, LogBox, Platform } from 'react-native';
import { useFonts, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, useAppTheme } from '../context/ThemeContext';
import { loadHapticsSetting } from '../lib/hapticsSetting';
import { AlertHost, appAlert } from '../ui';

SplashScreen.preventAutoHideAsync();
LogBox.ignoreLogs(['Accessing element.ref was removed']);

/** How full screens slide in and out (see the comment on <Stack> below). */
const PUSH_ANIMATION = Platform.OS === 'android' ? ('slide_from_right' as const) : ('ios_from_right' as const);

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
    // The phone's Back button: the stack itself goes back (with its slide). Only on the first screen
    // (Home or sign-in) do we step in and ask before closing the app.
    const onBackPress = () => {
      if (router.canGoBack()) {
        return false;
      } else {
        // At root (Home or Login)
        appAlert('Exit App', 'Are you sure you want to exit TechnoCycle?', [
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
              Android uses its own full slide (both screens move together, about 400 ms). Its 'ios_from_right' copy is
              fixed at about 200 ms and shows the screen underneath at once, so Back looked done before it animated. */}
          <Stack screenOptions={{ headerShown: false, animation: PUSH_ANIMATION, gestureEnabled: true }}>
            <Stack.Screen name="index" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="setup" options={{ animation: 'fade' }} />
          </Stack>
          <AlertHost />
        </CopilotProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
