import { Slot, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CopilotProvider } from 'react-native-copilot';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { BackHandler, Alert, View, LogBox } from 'react-native';
import { useFonts, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();
LogBox.ignoreLogs(['Accessing element.ref was removed']);

export default function RootLayout() {
  const router = useRouter();

  const [fontsLoaded, fontError] = useFonts({
    'DMSans-Regular': DMSans_400Regular,
    'DMSans-Medium': DMSans_500Medium,
    'DMSans-Bold': DMSans_700Bold,
  });

  // 4-second maximum safety fallback so splash screen never locks under an unexpected network freeze
  useEffect(() => {
    const timer = setTimeout(() => {
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
    return null; // Return null to keep splash screen up until fonts are loaded
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <CopilotProvider tooltipStyle={{ backgroundColor: '#ffffff', borderRadius: 16 }} stepNumberComponent={() => null}>
        <Slot />
      </CopilotProvider>
    </SafeAreaProvider>
  );
}
