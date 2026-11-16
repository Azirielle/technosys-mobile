// useTokens(): the current palette (light or dark, from Settings) plus type, spacing, corners and shadows.
import { useMemo } from 'react';
import { useAppTheme } from '../context/ThemeContext';
import { palettes, type, space, radius, shadow, fonts, Palette } from './tokens';

export function useTokens() {
  const { isDark } = useAppTheme();
  return useMemo(() => {
    const c: Palette = isDark ? palettes.dark : palettes.light;
    return { c, isDark, type, space, radius, fonts, shadow: isDark ? { card: {}, raised: {} } : shadow };
  }, [isDark]);
}
