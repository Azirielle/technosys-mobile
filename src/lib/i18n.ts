// Screen text in English or Filipino (src/locales/*.json), following the language chosen in setup or Settings.
// Usage: const t = useT(); t('setup.rules.title'); t('common.stepOf', { step: 2, total: 4 })
import { useCallback } from 'react';
import en from '../locales/en.json';
import fil from '../locales/fil.json';
import { useAppTheme } from '../context/ThemeContext';

type Dict = { [key: string]: string | Dict };
const DICTS: Record<string, Dict> = { en, tl: fil };

function lookup(dict: Dict, key: string): string | undefined {
  let node: string | Dict | undefined = dict;
  for (const part of key.split('.')) {
    if (!node || typeof node === 'string') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Text for a key; falls back to English, then to the key itself so a missing text is easy to spot. */
export function translate(language: string, key: string, vars?: Record<string, string | number>): string {
  let text = lookup(DICTS[language] ?? en, key) ?? lookup(en, key) ?? key;
  if (vars) for (const [name, value] of Object.entries(vars)) text = text.replace(`{${name}}`, String(value));
  return text;
}

export function useT() {
  const { language } = useAppTheme();
  return useCallback((key: string, vars?: Record<string, string | number>) => translate(language, key, vars), [language]);
}
