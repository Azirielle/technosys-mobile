import { Slot, useRouter } from 'expo-router';
import { CopilotProvider } from 'react-native-copilot';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { BackHandler, Alert } from 'react-native';

export default function RootLayout() {
  const router = useRouter();

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

  return (
    <>
      <StatusBar style="light" />
      <CopilotProvider tooltipStyle={{ backgroundColor: '#ffffff', borderRadius: 16 }} stepNumberComponent={() => null}>
        <Slot />
      </CopilotProvider>
    </>
  );
}
