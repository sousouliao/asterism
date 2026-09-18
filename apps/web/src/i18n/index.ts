import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';

const LANGUAGE_STORAGE_KEY = 'asterism-language';
const SUPPORTED_LANGUAGES = ['en', 'zh-CN'] as const;

type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

function readStoredLanguage(): SupportedLanguage | null {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isSupportedLanguage(stored) ? stored : null;
  } catch {
    return null;
  }
}

function persistLanguage(language: SupportedLanguage) {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Private mode or quota exhaustion keeps the choice in memory for this session.
  }
}

function syncDocumentLanguage(language: string | undefined) {
  if (typeof document !== 'undefined' && language) {
    document.documentElement.lang = language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
  }
}

const initialLanguage = readStoredLanguage() ?? 'en';

i18n.on('languageChanged', syncDocumentLanguage);

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'zh-CN': { translation: zhCN },
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

syncDocumentLanguage(i18n.resolvedLanguage ?? initialLanguage);

/** Switch the interface language and remember the choice across sessions. */
async function changeInterfaceLanguage(language: string): Promise<void> {
  if (!isSupportedLanguage(language)) {
    return;
  }

  persistLanguage(language);
  await i18n.changeLanguage(language);
}

export type { SupportedLanguage };
export { changeInterfaceLanguage, LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES };
export default i18n;
