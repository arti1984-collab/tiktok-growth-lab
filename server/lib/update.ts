import { APP_VERSION } from "../config.ts";
import { tr } from "./lang.ts";
import { effectiveSettings } from "./store.ts";

/**
 * Fragt die neueste Veroeffentlichung auf GitHub ab. Ist das Repo privat,
 * braucht die Abfrage ein Token (Einstellungen oder GITHUB_TOKEN), sonst
 * antwortet GitHub mit 404. Das Ergebnis wird kurz zwischengespeichert, damit
 * nicht jeder Seitenaufruf eine Anfrage kostet; ohne Netz bleibt die App bei
 * "kein Update" statt zu haengen.
 */

const REPO = (process.env.UPDATE_REPO || "arti1984-collab/tiktok-growth-lab").trim();
const CACHE_MS = 5 * 60_000;

export type UpdateInfo = {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  url: string | null;
  exe: string | null;
  exeSize: number | null;
  notes: string;
  publishedAt: string | null;
  checkedAt: number;
  error: string | null;
};

type ReleaseResponse = {
  tag_name?: string;
  html_url?: string;
  body?: string;
  published_at?: string;
  assets?: { id?: number; name?: string; browser_download_url?: string; size?: number }[];
};

let cache: { at: number; value: UpdateInfo } | null = null;

/** Koepfe fuer die GitHub-API, mit Token wenn eins hinterlegt ist. */
export function releaseHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "TikTok-Growth-Lab",
  };
  const clean = token.trim();
  if (clean) headers.authorization = `Bearer ${clean}`;
  return headers;
}

/**
 * Privates Repo: die browser_download_url liefert ohne Anmeldung 404. Dann
 * geht der Download ueber die Asset-API, die den Token akzeptiert.
 */
export function assetDownloadUrl(
  repo: string,
  asset: { id?: number; browser_download_url?: string } | null,
  token: string,
): string | null {
  if (!asset) return null;
  if (token.trim() && typeof asset.id === "number") {
    return `https://api.github.com/repos/${repo}/releases/assets/${asset.id}`;
  }
  return asset.browser_download_url ?? null;
}

/** 1.8.0 gegen 1.10.0: Zahlen vergleichen, nicht Zeichenketten. */
export function compareVersions(a: string, b: string): number {
  const split = (value: string) =>
    value
      .replace(/^v/i, "")
      .split(/[.+-]/)
      .map((part) => Number.parseInt(part, 10))
      .map((part) => (Number.isFinite(part) ? part : 0));
  const left = split(a);
  const right = split(b);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const one = left[index] ?? 0;
    const two = right[index] ?? 0;
    if (one !== two) return one > two ? 1 : -1;
  }
  return 0;
}

export function currentVersion(): string {
  return APP_VERSION;
}

export async function checkForUpdate(force = false): Promise<UpdateInfo> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  const base: UpdateInfo = {
    current: APP_VERSION,
    latest: null,
    updateAvailable: false,
    url: null,
    exe: null,
    exeSize: null,
    notes: "",
    publishedAt: null,
    checkedAt: Date.now(),
    error: null,
  };

  const token = effectiveSettings().githubToken;

  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: releaseHeaders(token),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = (await response.json()) as ReleaseResponse;
    const latest = (data.tag_name ?? "").replace(/^v/i, "").trim() || null;
    const assets = data.assets ?? [];
    const exeAsset =
      assets.find((asset) => (asset.name ?? "").toLowerCase().endsWith(".exe")) ?? null;

    const value: UpdateInfo = {
      ...base,
      latest,
      url: data.html_url ?? null,
      exe: assetDownloadUrl(REPO, exeAsset, token),
      exeSize: typeof exeAsset?.size === "number" ? exeAsset.size : null,
      notes: (data.body ?? "").slice(0, 1500),
      publishedAt: data.published_at ?? null,
      updateAvailable: Boolean(latest && compareVersions(latest, APP_VERSION) > 0),
    };
    cache = { at: Date.now(), value };
    return value;
  } catch (error) {
    // Netzfehler sind kein Grund für eine Fehlermeldung im Vordergrund.
    const message = error instanceof Error ? error.message : "";
    const value: UpdateInfo = {
      ...base,
      error: /HTTP 40[13]|HTTP 429/.test(message)
        ? tr(
            "GitHub hat die Abfrage gedrosselt. In ein paar Minuten noch einmal.",
            "GitHub throttled the request. Try again in a few minutes.",
          )
        : /HTTP 404/.test(message)
          ? token
            ? tr(
                "Repo oder Release nicht gefunden. Prüfe Repo-Namen und Token in den Einstellungen.",
                "Repository or release not found. Check the repo name and the token in the settings.",
              )
            : tr(
                "Kein Release gefunden. Ist das Repo privat, braucht die Prüfung ein Token in den Einstellungen.",
                "No release found. If the repo is private, the check needs a token in the settings.",
              )
          : /HTTP 401/.test(message)
            ? tr("Das GitHub-Token wurde abgelehnt.", "GitHub rejected the token.")
            : tr("Die Update-Abfrage hat nicht geklappt.", "The update check did not work."),
    };
    cache = { at: Date.now(), value };
    return value;
  }
}
