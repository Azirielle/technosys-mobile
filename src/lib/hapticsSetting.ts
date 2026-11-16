// The "Vibrate on tap" setting (Profile → General), saved on the phone. Loaded once when the app starts.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setHapticsEnabled } from '../ui/motion';

const KEY = 'haptics_on';

export async function loadHapticsSetting(): Promise<boolean> {
  const on = (await AsyncStorage.getItem(KEY).catch(() => null)) !== 'off';
  setHapticsEnabled(on);
  return on;
}

export async function saveHapticsSetting(on: boolean): Promise<void> {
  setHapticsEnabled(on);
  await AsyncStorage.setItem(KEY, on ? 'on' : 'off').catch(() => {});
}
