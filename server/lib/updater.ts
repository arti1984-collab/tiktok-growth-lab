import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../config.ts";
import { tr } from "./lang.ts";

/**
 * Laedt die neue Windows-Datei im Hintergrund in den Datenordner. Getauscht
 * wird sie erst beim Beenden: Windows laesst eine laufende exe nicht
 * ueberschreiben, deshalb wartet die Huelle auf den Programmende.
 */

export type DownloadState = "idle" | "downloading" | "ready" | "failed";

export type DownloadInfo = {
  state: DownloadState;
  version: string | null;
  received: number;
  total: number;
  percent: number;
  file: string | null;
  error: string | null;
};

const UPDATES_DIR = path.join(DATA_DIR, "updates");

const IDLE: DownloadInfo = {
  state: "idle",
  version: null,
  received: 0,
  total: 0,
  percent: 0,
  file: null,
  error: null,
};

let info: DownloadInfo = { ...IDLE };
let active = false;

export function downloadInfo(): DownloadInfo {
  return info;
}

/** Nur die Windows-App kann sich selbst ersetzen, im Browser waere es sinnlos. */
export function canDownload(): boolean {
  return process.env.APP_DESKTOP === "1";
}

export function startDownload(version: string, url: string, size: number): void {
  if (!canDownload() || active) return;
  if (info.state === "ready" && info.version === version) return;

  fs.mkdirSync(UPDATES_DIR, { recursive: true });
  const file = path.join(UPDATES_DIR, `TikTok-Growth-Lab-${version}.exe`);

  // Ein abgebrochener Lauf hat die Datei schon vollstaendig hinterlassen.
  try {
    if (size > 0 && fs.statSync(file).size === size) {
      info = { state: "ready", version, received: size, total: size, percent: 100, file, error: null };
      announce();
      return;
    }
  } catch {
    // Datei fehlt, also normal laden
  }

  active = true;
  info = { state: "downloading", version, received: 0, total: size, percent: 0, file: null, error: null };

  void (async () => {
    const part = `${file}.part`;
    try {
      for (const entry of fs.readdirSync(UPDATES_DIR)) {
        if (entry.endsWith(".part")) fs.rmSync(path.join(UPDATES_DIR, entry), { force: true });
      }

      const response = await fetch(url, {
        headers: { "user-agent": "TikTok-Growth-Lab" },
        signal: AbortSignal.timeout(30 * 60_000),
      });
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

      const announced = Number(response.headers.get("content-length")) || 0;
      if (announced > 0) info = { ...info, total: announced };

      const out = fs.createWriteStream(part);
      const reader = response.body.getReader();
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (!out.write(Buffer.from(value))) {
          await new Promise<void>((resolve) => out.once("drain", () => resolve()));
        }
        info = {
          ...info,
          received,
          percent: info.total > 0 ? Math.min(99, Math.round((received / info.total) * 100)) : 0,
        };
      }
      await new Promise<void>((resolve, reject) => {
        out.once("error", reject);
        out.end(() => resolve());
      });

      if (!looksLikeWindowsApp(part)) {
        throw new Error(
          tr("Die geladene Datei ist keine Windows-Anwendung.", "The downloaded file is not a Windows application."),
        );
      }

      fs.rmSync(file, { force: true });
      fs.renameSync(part, file);
      const bytes = fs.statSync(file).size;
      info = { state: "ready", version, received: bytes, total: bytes, percent: 100, file, error: null };
      announce();
    } catch (error) {
      fs.rmSync(part, { force: true });
      info = {
        ...IDLE,
        state: "failed",
        version,
        error: error instanceof Error ? error.message : String(error),
      };
      // Ein Fehlversuch darf den naechsten Start nicht blockieren.
      setTimeout(() => {
        if (info.state === "failed") info = { ...IDLE };
      }, 60_000).unref();
    } finally {
      active = false;
    }
  })();
}

/** Eine echte Windows-exe beginnt mit MZ und ist groesser als eine Fehlerseite. */
function looksLikeWindowsApp(file: string): boolean {
  if (fs.statSync(file).size < 1_000_000) return false;
  const head = Buffer.alloc(2);
  const handle = fs.openSync(file, "r");
  try {
    fs.readSync(handle, head, 0, 2, 0);
  } finally {
    fs.closeSync(handle);
  }
  return head.toString("latin1") === "MZ";
}

/** Meldet der Huelle die fertige Datei; im Browser gibt es keinen Empfaenger. */
function announce(): void {
  const bridge = (globalThis as { __tiktokUpdateReady?: (file: string, version: string) => void })
    .__tiktokUpdateReady;
  if (bridge && info.file && info.version) bridge(info.file, info.version);
}
