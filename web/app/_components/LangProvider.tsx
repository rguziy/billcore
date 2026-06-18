"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getPreferredLanguage, setPreferredLanguage } from "@/lib/auth";
import { setLanguage, type Language, DEFAULT_LANGUAGE } from "@/lib/i18n";

interface LangContextType {
  lang: Language;
  setLang: (lang: Language) => void;
}

const LangContext = createContext<LangContextType | undefined>(undefined);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(DEFAULT_LANGUAGE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const prefLang = (getPreferredLanguage() as Language) || DEFAULT_LANGUAGE;
    setLangState(prefLang);
    document.documentElement.lang = prefLang;
    setMounted(true);
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    setPreferredLanguage(newLang);
    setLanguage(newLang);
    document.documentElement.lang = newLang;
  };

  if (!mounted) return <>{children}</>;

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const context = useContext(LangContext);
  if (!context) {
    throw new Error("useLang must be used within LangProvider");
  }
  return context;
}
