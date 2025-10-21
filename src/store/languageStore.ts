import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { sv } from '@/locales/sv';
import { en } from '@/locales/en';
import { es } from '@/locales/es';

export type Language = 'sv' | 'en' | 'es';

const translations = {
  sv,
  en,
  es,
};

interface LanguageStore {
  language: Language;
  t: typeof sv;
  setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set) => ({
      language: 'sv',
      t: sv,
      setLanguage: (lang: Language) =>
        set({
          language: lang,
          t: translations[lang],
        }),
    }),
    {
      name: 'language-storage',
    }
  )
);
