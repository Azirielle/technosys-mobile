import { Slot, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CopilotProvider } from 'react-native-copilot';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { BackHandler, Alert, View } from 'react-native';
import { useFonts, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();

  const [fontsLoaded, fontError] = useFonts({
    'DMSans-Regular': DMSans_400Regular,
    'DMSans-Medium': DMSans_500Medium,
    'DMSans-Bold': DMSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    const onBackPress = () => {
      if (router.canGoBack()) {
        router.back();
        return true;
      } else {
        // At root (Home or Login)
        Alert.alert('Exit App', 'Are you sure you want to exit TechnoSys Mobile?', [
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
