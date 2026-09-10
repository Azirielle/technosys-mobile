import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeColors, AppThemeColors } from '../constants/theme';
import { supabase } from '../lib/supabase';

export type ThemeMode = 'light' | 'dark' | 'system';
export type AppLanguage = 'en' | 'tl' | 'ja';

interface ThemeContextValue {
  themeMode: ThemeMode;
  isDark: boolean;
  language: AppLanguage;
  colors: AppThemeColors;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setLanguage: (lang: AppLanguage) => Promise<void>;
  isLoaded: boolean;
}

const STORAGE_THEME_KEY = '@technocycle_theme_mode';
const STORAGE_LANG_KEY = '@technocycle_language';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [language, setLanguageState] = useState<AppLanguage>('en');
  const [isLoaded, setIsLoaded] = useState(false);

  // Compute effective dark mode
  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return systemScheme === 'dark';
    }
    return themeMode === 'dark';
  }, [themeMode, systemScheme]);

  const colors = useMemo(() => {
    return isDark ? ThemeColors.dark : ThemeColors.light;
  }, [isDark]);

  // Load preferences from AsyncStorage and Supabase
  useEffect(() => {
    let isMounted = true;

    async function loadPreferences() {
      try {
        const [savedTheme, savedLang] = await Promise.all([
          AsyncStorage.getItem(STORAGE_THEME_KEY),
          AsyncStorage.getItem(STORAGE_LANG_KEY),
        ]);

        if (!isMounted) return;

        if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system')) {
          setThemeModeState(savedTheme as ThemeMode);
        }
        if (savedLang && (savedLang === 'en' || savedLang === 'tl' || savedLang === 'ja')) {
          setLanguageState(savedLang as AppLanguage);
        }

        // Check Supabase if user is logged in
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('user_preferences')
            .eq('id', session.user.id)
            .single();

          if (profile?.user_preferences && isMounted) {
            const remote = profile.user_preferences as any;
            if (!savedTheme && remote.theme && ['light', 'dark', 'system'].includes(remote.theme)) {
              setThemeModeState(remote.theme);
              AsyncStorage.setItem(STORAGE_THEME_KEY, remote.theme).catch(() => {});
            }
            if (!savedLang && remote.language && ['en', 'tl', 'ja'].includes(remote.language)) {
              setLanguageState(remote.language);
              AsyncStorage.setItem(STORAGE_LANG_KEY, remote.language).catch(() => {});
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load user preferences:', e);
      } finally {
        if (isMounted) setIsLoaded(true);
      }
    }

    loadPreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(STORAGE_THEME_KEY, mode);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_preferences')
          .eq('id', session.user.id)
          .single();

        const currentPrefs = profile?.user_preferences || {};
        await supabase
          .from('profiles')
          .update({
            user_preferences: {
              ...currentPrefs,
              theme: mode,
            },
          })
          .eq('id', session.user.id);
      }
    } catch (e) {
      console.warn('Failed to persist theme mode:', e);
    }
  };

  const setLanguage = async (lang: AppLanguage) => {
    setLanguageState(lang);
    try {
      await AsyncStorage.setItem(STORAGE_LANG_KEY, lang);

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_preferences')
          .eq('id', session.user.id)
          .single();

        const currentPrefs = profile?.user_preferences || {};
        await supabase
          .from('profiles')
          .update({
            user_preferences: {
              ...currentPrefs,
              language: lang,
            },
          })
          .eq('id', session.user.id);
      }
    } catch (e) {
      console.warn('Failed to persist language preference:', e);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        isDark,
        language,
        colors,
        setThemeMode,
        setLanguage,
        isLoaded,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return context;
}
