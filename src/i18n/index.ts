import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { ja } from './locales/ja';

export const SUPPORTED_LANGUAGES = ['ja'] as const;
export const DEFAULT_LANGUAGE = 'ja';

export const resources = {
  ja: { translation: ja },
} as const;

function detectLanguage(): string {
  const code = getLocales()[0]?.languageCode ?? DEFAULT_LANGUAGE;
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code) ? code : DEFAULT_LANGUAGE;
}

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
  returnNull: false,
  initAsync: false,
});

export default i18n;
