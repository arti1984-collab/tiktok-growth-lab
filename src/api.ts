import { tr } from "./lang";
import type { Account, AiMode, AiResponse, Provider, PublicSettings, ScanResult, Status, UpdateInfo } from "./types";

export class ApiError extends Error {
  hint: string;
  code: string;
  constructor(message: string, hint = "", code = "") {
    super(message);
    this.name = "ApiError";
    this.hint = hint;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(
      tr("Der lokale Server ist nicht erreichbar.", "The local server cannot be reached."),
      tr("Läuft `npm run dev` noch?", "Is `npm run dev` still running?"),
    );
  }
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const body = (payload ?? {}) as { error?: string; hint?: string; code?: string };
    throw new ApiError(
      body.error ?? tr(`Anfrage fehlgeschlagen (HTTP ${response.status}).`, `Request failed (HTTP ${response.status}).`),
      body.hint ?? "",
      body.code ?? "",
    );
  }
  return payload as T;
}

export const api = {
  status: () => request<Status>("/api/status"),

  /** Latest GitHub release compared to the running version. */
  update: (force = false) => request<UpdateInfo>(`/api/update${force ? "?force=1" : ""}`),

  scan: (payload: { handle: string; videoUrls: string[]; track: boolean }) =>
    request<ScanResult>("/api/scan", { method: "POST", body: JSON.stringify(payload) }),

  /** Last scan the server still holds in memory – used to restore context after a reload. */
  lastScan: () => request<ScanResult>("/api/last-scan"),

  ai: (payload: { mode: AiMode; handle?: string; payload: Record<string, unknown> }) =>
    request<AiResponse>("/api/ai", { method: "POST", body: JSON.stringify(payload) }),

  models: (payload: { aiBaseUrl?: string; aiApiKey?: string } = {}) =>
    request<{ models: string[]; free: string[] }>("/api/ai/models", { method: "POST", body: JSON.stringify(payload) }),

  providers: () => request<{ providers: Provider[] }>("/api/ai/providers"),

  watchlist: () => request<{ accounts: Account[] }>("/api/watchlist"),

  track: (handle: string) =>
    request<{ account: Account; accounts: Account[] }>("/api/watchlist", {
      method: "POST",
      body: JSON.stringify({ handle }),
    }),

  refreshWatchlist: () =>
    request<{ accounts: Account[]; errors: { handle: string; message: string }[] }>("/api/watchlist/refresh", {
      method: "POST",
      body: JSON.stringify({}),
    }),

  untrack: (handle: string) =>
    request<{ accounts: Account[] }>(`/api/watchlist/${encodeURIComponent(handle)}`, { method: "DELETE" }),

  settings: () => request<PublicSettings>("/api/settings"),

  saveSettings: (patch: Record<string, unknown>) =>
    request<PublicSettings>("/api/settings", { method: "PUT", body: JSON.stringify(patch) }),

  clearCache: () => request<{ ok: boolean }>("/api/cache/clear", { method: "POST", body: JSON.stringify({}) }),
};
