/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useAppTheme } from '@/context/ThemeContext';

export { useAppTheme };

export function useTheme() {
  try {
    const { colors, isDark } = useAppTheme();
    return {
      ...Colors[isDark ? 'dark' : 'light'],
      ...colors,
    };
  } catch {
    return Colors.light;
  }
}
