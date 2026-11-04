export type Lang = "de" | "en";

/**
 * Die Sprache der Antworten hängt an der Anfrage, nicht an einem globalen
 * Zustand: ein einzelner Nutzer, aber sauber getrennt pro Request.
 * Voreinstellung ist Deutsch.
 */
let current: Lang = "de";

export const setLang = (lang: Lang): void => {
  current = lang;
};

export const getLang = (): Lang => current;

export const tr = (de: string, en: string): string => (current === "en" ? en : de);

export const locale = (): string => (current === "en" ? "en-US" : "de-DE");
