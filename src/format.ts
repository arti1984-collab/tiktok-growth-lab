import { activeLanguage } from "./lang";

/**
 * Alle Zahlen, Prozente und Datumsangaben laufen über die eingestellte
 * Sprache: deutsche Kommas und "4,5 %" oder englische Punkte und "4.5%".
 */

const WEEKDAYS_DE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const WEEKDAYS_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const locale = (): string => (activeLanguage() === "en" ? "en-US" : "de-DE");

export const weekdays = (): string[] => (activeLanguage() === "en" ? WEEKDAYS_EN : WEEKDAYS_DE);

/** Index 0 = Montag, passend zu den Wochentagszahlen aus der Auswertung. */
export const weekdayName = (index: number): string => weekdays()[index] ?? "?";

const formatterCache = new Map<string, Intl.NumberFormat>();

function numberFormatter(options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = `${locale()}|${JSON.stringify(options)}`;
  const cached = formatterCache.get(key);
  if (cached) return cached;
  const created = new Intl.NumberFormat(locale(), options);
  formatterCache.set(key, created);
  return created;
}

export const formatNumber = (value: number | null | undefined): string =>
  value === null || value === undefined ? "–" : numberFormatter().format(Math.round(value));

export const formatCompact = (value: number | null | undefined): string =>
  value === null || value === undefined
    ? "–"
    : numberFormatter({ notation: "compact", maximumFractionDigits: 1 }).format(value);

export const formatPercent = (value: number | null | undefined, digits = 1): string =>
  value === null || value === undefined
    ? "–"
    : numberFormatter({ style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value / 100);

export const formatDecimal = (value: number | null | undefined, digits = 2): string =>
  value === null || value === undefined
    ? "–"
    : numberFormatter({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

export const formatSigned = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "–";
  const sign = value > 0 ? "+" : "";
  return `${sign}${numberFormatter().format(Math.round(value))}`;
};

export const formatDate = (unixSeconds: number): string =>
  new Date(unixSeconds * 1000).toLocaleDateString(locale(), { day: "2-digit", month: "short", year: "numeric" });

export const formatDateTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleString(locale(), {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export const formatDuration = (seconds: number): string => {
  const value = Math.round(seconds);
  if (value < 60) return `${value} s`;
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  return rest === 0 ? `${minutes} min` : `${minutes}:${String(rest).padStart(2, "0")} min`;
};

export const awayFromNow = (unixSeconds: number): string => {
  const days = Math.round((Date.now() / 1000 - unixSeconds) / 86400);
  const english = activeLanguage() === "en";
  if (days <= 0) return english ? "today" : "heute";
  if (days === 1) return english ? "yesterday" : "gestern";
  return english ? `${days} days ago` : `vor ${days} Tagen`;
};
