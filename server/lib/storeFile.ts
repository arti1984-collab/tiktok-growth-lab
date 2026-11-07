import fs from "node:fs";
import path from "node:path";

/**
 * Lesen und Schreiben der Datendatei an einer Stelle. Warum eigenes Modul:
 * das Schreiben legt vor jedem Austausch eine Sicherung an, und ein
 * unlesbarer Inhalt wird nicht ueberschrieben, sondern mit Zeitstempel
 * wegglegt. Beides laesst sich so ohne laufenden Server pruefen.
 */

export type LoadResult<T> = {
  data: T;
  migrated: boolean;
  /** Pfad der wegglegten kaputten Datei, sonst null. */
  brokenFile: string | null;
  /** true, wenn die Sicherung die Daten geliefert hat. */
  usedBackup: boolean;
  /** Kurzer Grund, wenn nichts gelesen werden konnte. */
  error: string;
};

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === "ENOENT";
}

/**
 * Liest die Datei, sonst die Sicherung, sonst einen leeren Speicher. Eine
 * kaputte Hauptdatei wandert nach `<datei>.broken-<zeit>`, damit sie nicht
 * beim naechsten Speichern verschwindet.
 */
export function loadJsonStore<T>(options: {
  file: string;
  backup: string;
  empty: () => T;
  normalize: (raw: unknown) => { data: T; migrated: boolean };
}): LoadResult<T> {
  const { file, backup, empty, normalize } = options;
  let brokenFile: string | null = null;
  let firstError = "";

  try {
    const parsed = normalize(JSON.parse(fs.readFileSync(file, "utf8")));
    return { ...parsed, brokenFile: null, usedBackup: false, error: "" };
  } catch (error) {
    firstError = (error as Error)?.message ?? "unbekannter Fehler";
    if (!isMissing(error)) {
      const target = `${file}.broken-${stamp()}`;
      try {
        fs.renameSync(file, target);
        brokenFile = target;
      } catch {
        // Wenn selbst das Umbenennen scheitert, bleibt die Datei liegen.
      }
    }
  }

  try {
    const parsed = normalize(JSON.parse(fs.readFileSync(backup, "utf8")));
    return { ...parsed, migrated: true, brokenFile, usedBackup: true, error: firstError };
  } catch {
    if (brokenFile) return { data: empty(), migrated: false, brokenFile, usedBackup: false, error: firstError };
    return { data: empty(), migrated: false, brokenFile: null, usedBackup: false, error: "" };
  }
}

/**
 * Schreibt erst in eine Temporärdatei, sichert den alten Stand und tauscht
 * dann aus. Bricht der Vorgang ab, ist die alte Datei noch vollständig da.
 */
export function writeJsonStore(file: string, backup: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, backup);
  }
  fs.renameSync(tmp, file);
}
