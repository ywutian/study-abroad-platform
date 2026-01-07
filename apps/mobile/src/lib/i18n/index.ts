import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { storage } from '../storage/secure-store';

import zh from './locales/zh.json';
import en from './locales/en.json';

const LANGUAGE_KEY = 'app_language';

const resources = {
  zh: { translation: zh },
  en: { translation: en },
};

// Get saved language or system language
async function getInitialLanguage(): Promise<string> {
  const savedLanguage = await storage.get<string>(LANGUAGE_KEY);
  if (savedLanguage && ['zh', 'en'].includes(savedLanguage)) {
    return savedLanguage;
  }
  
  // Use system language
  const systemLanguage = Localization.getLocales()[0]?.languageCode || 'zh';
  return systemLanguage === 'zh' ? 'zh' : 'en';
}

export async function initI18n(): Promise<typeof i18n> {
  const lng = await getInitialLanguage();

  await i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: 'zh',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

  return i18n;
}

export async function changeLanguage(language: 'zh' | 'en'): Promise<void> {
  await storage.set(LANGUAGE_KEY, language);
  await i18n.changeLanguage(language);
}

export function getCurrentLanguage(): string {
  return i18n.language || 'zh';
}

export { i18n };




