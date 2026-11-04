import { createContext, useContext, type ReactNode } from "react";

export type Lang = "de" | "en";

/** t("Deutsch", "English") – der kurze Weg für Texte, die nur an einer Stelle stehen. */
export type Translate = (de: string, en: string) => string;

/**
 * Die Sprache muss auch außerhalb von React lesbar sein: Zahlenformate,
 * Datei-Exporte und Fehlertexte entstehen in eigenen Modulen. Deshalb liegt
 * sie doppelt, einmal als Modulwert und einmal im Context für das Neuzeichnen.
 */
let activeLang: Lang = "de";

export function setActiveLang(lang: Lang): void {
  activeLang = lang;
}

export const activeLanguage = (): Lang => activeLang;

/** Übersetzt ohne Hook – für Module, die keine Komponente sind. */
export const tr = (de: string, en: string): string => (activeLang === "en" ? en : de);

const LangContext = createContext<{ lang: Lang; t: Translate }>({
  lang: "de",
  t: (de) => de,
});

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const t: Translate = lang === "en" ? (_de, en) => en : (de) => de;
  return <LangContext.Provider value={{ lang, t }}>{children}</LangContext.Provider>;
}

export const useLang = (): Lang => useContext(LangContext).lang;

export const useT = (): Translate => useContext(LangContext).t;
