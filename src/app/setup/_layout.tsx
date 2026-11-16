// First-time setup pages (language → app rules → this phone → permissions). Plain stack:
// the phone's Back button goes to the previous step; no swipe-down sheets.
import { Stack } from 'expo-router';

export default function SetupLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
