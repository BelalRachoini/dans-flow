import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguageStore, type Language } from '@/store/languageStore';
import { toast } from 'sonner';

const languageNames: Record<Language, string> = {
  sv: 'Svenska',
  en: 'English',
  es: 'Español',
};

const languageCodes: Record<Language, string> = {
  sv: 'SV',
  en: 'EN',
  es: 'ES',
};

export function LanguageMenu() {
  const { language, setLanguage, t } = useLanguageStore();

  const handleLanguageChange = async (newLang: Language) => {
    if (newLang === language) return;
    
    await setLanguage(newLang);
    const langName = t.language[newLang === 'sv' ? 'swedish' : newLang === 'en' ? 'english' : 'spanish'];
    toast.success(`${t.language.title} ändrat till ${langName}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{languageCodes[language]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => handleLanguageChange('sv')}
          className={language === 'sv' ? 'bg-accent' : ''}
        >
          {languageNames.sv}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleLanguageChange('en')}
          className={language === 'en' ? 'bg-accent' : ''}
        >
          {languageNames.en}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleLanguageChange('es')}
          className={language === 'es' ? 'bg-accent' : ''}
        >
          {languageNames.es}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
