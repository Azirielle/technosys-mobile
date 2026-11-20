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
import { useT } from '../lib/i18n';

SplashScreen.preventAutoHideAsync();
LogBox.ignoreLogs(['Accessing element.ref was removed']);

/** How full screens slide in and out (see the comment on <Stack> below). */
const PUSH_ANIMATION = Platform.OS === 'android' ? ('slide_from_right' as const) : ('ios_from_right' as const);

/** The phone's Back button: the stack itself goes back (with its slide). Only on the first screen (Home or sign-in)
 *  do we ask before closing the app, in the same look and words as Profile's Sign out pop-up. */
function ExitOnBack() {
  const router = useRouter();
  const t = useT();
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) return false;
      appAlert(t('common.exitTitle'), t('common.exitText'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.exit'), style: 'destructive', onPress: () => BackHandler.exitApp() },
      ]);
      return true;
    });
    return () => sub.remove();
  }, [router, t]);
  return null;
}

function RootStatusBar() {
  const { isDark } = useAppTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export default function RootLayout() {

  const [fontsLoaded, fontError] = useFonts({
    'DMSans-Regular': DMSans_400Regular,
    'DMSans-Medium': DMSans_500Medium,
    'DMSans-Bold': DMSans_700Bold,
    // The app's font (docs/ui-library/type-and-layout.md). DM Sans stays until every old screen is redone.
    'Jakarta-Regular': PlusJakartaSans_400Regular,
    'Jakarta-SemiBold': PlusJakartaSans_600SemiBold,
    'Jakarta-Bold': PlusJakartaSans_700Bold,
  });

  // "Haptic feedback" (Profile) is read before any button can buzz
  useEffect(() => { loadHapticsSetting(); }, []);

  // Safety fallback timeout to ensure native splash never freezes
  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <RootStatusBar />
        <ExitOnBack />
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
