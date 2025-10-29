import { useContext } from 'react';
import { AppContext } from '@/context/AppContext';
import en from '@/locales/en.json';
import ja from '@/locales/ja.json';

const translations = { en, ja };

export const useTranslation = () => {
  const { language } = useContext(AppContext);

  const t = (key, replacements = {}) => {
    let translation = translations[language]?.[key] || key;
    
    Object.keys(replacements).forEach(placeholder => {
        const regex = new RegExp(`{${placeholder}}`, 'g');
        translation = translation.replace(regex, replacements[placeholder]);
    });

    return translation;
  };

  return { t, language };
};