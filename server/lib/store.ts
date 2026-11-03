import fs from "node:fs";
import { DATA_DIR, ENV_DEFAULTS, STORE_FILE } from "../config.ts";

export type Snapshot = {
  at: number;
  followers: number;
  following: number;
  hearts: number;
  videos: number;
  engagementRate: number | null;
  score: number | null;
};

export type TrackedAccount = {
  handle: string;
  nickname: string;
  avatar: string;
  addedAt: number;
  snapshots: Snapshot[];
};

export type Settings = {
  aiBaseUrl?: string;
  aiModel?: string;
  aiApiKey?: string;
  cookie?: string;
  minDelayMs?: number;
  timezone?: string;
};

type StoreShape = {
  version: 1;
  accounts: TrackedAccount[];
  settings: Settings;
};

const MAX_SNAPSHOTS = 200;

function emptyStore(): StoreShape {
  return { version: 1, accounts: [], settings: {} };
}

function load(): StoreShape {
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    return {
      version: 1,
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      settings: parsed.settings && typeof parsed.settings === "object" ? parsed.settings : {},
    };
  } catch {
    return emptyStore();
  }
}

let data: StoreShape = load();
let saveTimer: NodeJS.Timeout | null = null;

function persistNow() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${STORE_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tmp, STORE_FILE);
  } catch (error) {
    console.error("[store] could not save:", (error as Error).message);
  }
}

function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 150);
}

export function getSettings(): Settings {
  return { ...data.settings };
}

export function effectiveSettings() {
  const s = data.settings;
  return {
    aiBaseUrl: s.aiBaseUrl || ENV_DEFAULTS.aiBaseUrl,
    aiModel: s.aiModel || ENV_DEFAULTS.aiModel,
    aiApiKey: s.aiApiKey || ENV_DEFAULTS.aiApiKey,
    cookie: s.cookie || ENV_DEFAULTS.cookie,
    minDelayMs: Number(s.minDelayMs && s.minDelayMs > 0 ? s.minDelayMs : ENV_DEFAULTS.minDelayMs),
    cacheTtlMs: ENV_DEFAULTS.cacheTtlMs,
    timezone: s.timezone || ENV_DEFAULTS.timezone,
  };
}

/** Public view of the settings – never contains the API key or the cookie itself. */
export function publicSettings() {
  const eff = effectiveSettings();
  return {
    aiBaseUrl: eff.aiBaseUrl,
    aiModel: eff.aiModel,
    hasApiKey: Boolean(eff.aiApiKey),
    apiKeySource: data.settings.aiApiKey ? "ui" : ENV_DEFAULTS.aiApiKey ? "env" : "none",
    cookieSet: Boolean(eff.cookie),
    cookieSource: data.settings.cookie ? "ui" : ENV_DEFAULTS.cookie ? "env" : "none",
    minDelayMs: eff.minDelayMs,
    timezone: eff.timezone,
  };
}

export function updateSettings(patch: Settings) {
  const next: Settings = { ...data.settings };
  for (const key of ["aiBaseUrl", "aiModel", "aiApiKey", "cookie", "timezone"] as const) {
    const value = patch[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    // empty string clears the override and falls back to .env
    if (trimmed === "") delete next[key];
    else next[key] = trimmed;
  }
  if (typeof patch.minDelayMs === "number" && Number.isFinite(patch.minDelayMs)) {
    const delay = Math.max(400, Math.min(10_000, Math.round(patch.minDelayMs)));
    next.minDelayMs = delay;
  }
  data.settings = next;
  persist();
  return publicSettings();
}

export function listAccounts(): TrackedAccount[] {
  return data.accounts.map((account) => ({ ...account, snapshots: [...account.snapshots] }));
}

export function findAccount(handle: string): TrackedAccount | undefined {
  const key = handle.toLowerCase();
  return data.accounts.find((account) => account.handle.toLowerCase() === key);
}

export function trackAccount(handle: string, nickname: string, avatar: string): TrackedAccount {
  const existing = findAccount(handle);
  if (existing) {
    existing.nickname = nickname || existing.nickname;
    existing.avatar = avatar || existing.avatar;
    persist();
    return existing;
  }
  const account: TrackedAccount = {
    handle,
    nickname: nickname || handle,
    avatar: avatar || "",
    addedAt: Date.now(),
    snapshots: [],
  };
  data.accounts.push(account);
  persist();
  return account;
}

export function untrackAccount(handle: string): boolean {
  const key = handle.toLowerCase();
  const before = data.accounts.length;
  data.accounts = data.accounts.filter((account) => account.handle.toLowerCase() !== key);
  const removed = data.accounts.length !== before;
  if (removed) persist();
  return removed;
}

export function addSnapshot(handle: string, snapshot: Snapshot): TrackedAccount | undefined {
  const account = findAccount(handle);
  if (!account) return undefined;
  account.snapshots.push(snapshot);
  if (account.snapshots.length > MAX_SNAPSHOTS) {
    account.snapshots = account.snapshots.slice(-MAX_SNAPSHOTS);
  }
  persist();
  return account;
}
