import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Cookies from 'js-cookie';
import { supabase } from '@/integrations/supabase/client';
import { sv } from '@/locales/sv';
import { en } from '@/locales/en';
import { es } from '@/locales/es';

export type Language = 'sv' | 'en' | 'es';
export type Locale = Language; // alias for compatibility

const translations = {
  sv,
  en,
  es,
};

const COOKIE_NAME = 'locale';
const COOKIE_MAX_AGE = 365; // days

interface LanguageStore {
  language: Language;
  t: typeof sv;
  setLanguage: (lang: Language) => Promise<void>;
  loadUserPreferredLocale: (userId: string) => Promise<void>;
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set) => ({
      language: 'sv',
      t: sv,
      
      setLanguage: async (newLang: Language) => {
        // Update state
        set({
          language: newLang,
          t: translations[newLang],
        });
        
        // Update cookie
        Cookies.set(COOKIE_NAME, newLang, { 
          expires: COOKIE_MAX_AGE,
          path: '/',
          sameSite: 'lax'
        });
        
        // Update user profile if authenticated
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase
              .from('profiles')
              .update({ preferred_locale: newLang })
              .eq('id', user.id);
          }
        } catch (error) {
          console.error('Error updating user locale preference:', error);
        }

        // Update HTML lang attribute
        document.documentElement.lang = newLang;
      },

      loadUserPreferredLocale: async (userId: string) => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('preferred_locale')
            .eq('id', userId)
            .maybeSingle();

          if (!error && data?.preferred_locale) {
            const userLocale = data.preferred_locale as Language;
            set({ 
              language: userLocale, 
              t: translations[userLocale] 
            });
            
            // Update cookie to match
            Cookies.set(COOKIE_NAME, userLocale, { 
              expires: COOKIE_MAX_AGE,
              path: '/',
              sameSite: 'lax'
            });
            
            // Update HTML lang attribute
            document.documentElement.lang = userLocale;
          }
        } catch (error) {
          console.error('Error loading user locale:', error);
        }
      },
    }),
    {
      name: 'language-storage',
    }
  )
);

// Initialize locale from cookie or default to 'sv'
export const initializeLocale = () => {
  const cookieLocale = Cookies.get(COOKIE_NAME) as Language | undefined;
  if (cookieLocale && ['sv', 'en', 'es'].includes(cookieLocale)) {
    useLanguageStore.setState({ 
      language: cookieLocale, 
      t: translations[cookieLocale] 
    });
    document.documentElement.lang = cookieLocale;
  } else {
    // Set default
    Cookies.set(COOKIE_NAME, 'sv', { 
      expires: COOKIE_MAX_AGE,
      path: '/',
      sameSite: 'lax'
    });
    document.documentElement.lang = 'sv';
  }
};
