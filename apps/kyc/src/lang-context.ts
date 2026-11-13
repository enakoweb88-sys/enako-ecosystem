import { createContext, useContext } from 'react';
export type Lang = 'en' | 'fr';
export const LangContext = createContext<{ lang: Lang; setLang: (language: Lang) => void }>({ lang: 'en', setLang: () => {} });
export const useLang = () => useContext(LangContext);
