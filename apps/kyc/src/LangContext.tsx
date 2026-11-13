import { useState } from 'react';
import { LangContext, type Lang } from './lang-context';
import type { ReactNode } from 'react';

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem('enako_language') as Lang) || 'en';
  });

  const setLang = (l: Lang) => {
    localStorage.setItem('enako_language', l);
    setLangState(l);
  };

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}
