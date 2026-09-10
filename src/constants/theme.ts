/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const BrandColors = {
  blue: '#1E3A8A',
  blueLight: '#3B82F6',
  yellow: '#FBBF24',
  green: '#10B981',
  red: '#EF4444',
  lightBg: '#F8FAFC',
  darkBg: '#0B0F17',
} as const;

export type ThemePalette = {
  bg: string;
  card: string;
  cardBorder: string;
  subCard: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  border: string;
  inputBg: string;
  inputBorder: string;
  divider: string;
  modalOverlay: string;
  brandBlue: string;
  brandYellow: string;
  brandGreen: string;
  brandRed: string;
};

export const ThemeColors: { light: ThemePalette; dark: ThemePalette } = {
  light: {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    cardBorder: '#E2E8F0',
    subCard: '#F1F5F9',
    text: '#0F172A',
    textMuted: '#64748B',
    textSubtle: '#94A3B8',
    border: '#F1F5F9',
    inputBg: '#F8FAFC',
    inputBorder: '#E2E8F0',
    divider: '#F1F5F9',
    modalOverlay: 'rgba(0, 0, 0, 0.4)',
    brandBlue: '#1E3A8A',
    brandYellow: '#FBBF24',
    brandGreen: '#10B981',
    brandRed: '#EF4444',
  },
  dark: {
    bg: '#0B0F17',
    card: '#151D2A',
    cardBorder: '#243247',
    subCard: '#1E293B',
    text: '#F8FAFC',
    textMuted: '#94A3B8',
    textSubtle: '#64748B',
    border: '#1E293B',
    inputBg: '#1E293B',
    inputBorder: '#334155',
    divider: '#1E293B',
    modalOverlay: 'rgba(0, 0, 0, 0.75)',
    brandBlue: '#3B82F6',
    brandYellow: '#FBBF24',
    brandGreen: '#10B981',
    brandRed: '#EF4444',
  },
};

export type AppThemeColors = ThemePalette;

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
