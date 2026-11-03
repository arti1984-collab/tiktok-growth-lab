export const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
export const WEEKDAYS_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const numberFormatter = new Intl.NumberFormat("de-DE");
const compactFormatter = new Intl.NumberFormat("de-DE", { notation: "compact", maximumFractionDigits: 1 });

export const formatNumber = (value: number | null | undefined): string =>
  value === null || value === undefined ? "–" : numberFormatter.format(Math.round(value));

export const formatCompact = (value: number | null | undefined): string =>
  value === null || value === undefined ? "–" : compactFormatter.format(value);

export const formatPercent = (value: number | null | undefined, digits = 1): string =>
  value === null || value === undefined ? "–" : `${value.toFixed(digits).replace(".", ",")} %`;

export const formatDecimal = (value: number | null | undefined, digits = 2): string =>
  value === null || value === undefined ? "–" : value.toFixed(digits).replace(".", ",");

export const formatSigned = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "–";
  const sign = value > 0 ? "+" : "";
  return `${sign}${numberFormatter.format(Math.round(value))}`;
};

export const formatDate = (unixSeconds: number): string =>
  new Date(unixSeconds * 1000).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });

export const formatDateTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleString("de-DE", {
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
  if (days <= 0) return "heute";
  if (days === 1) return "gestern";
  return `vor ${days} Tagen`;
};
