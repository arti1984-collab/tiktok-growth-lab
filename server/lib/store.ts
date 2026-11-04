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
  language?: "de" | "en";
  aiBaseUrl?: string;
  aiModel?: string;
  aiApiKey?: string;
  githubToken?: string;
  cookie?: string;
  minDelayMs?: number;
  timezone?: string;
};

export type PlanStatus = "planned" | "done" | "skipped";

export type PlanItem = {
  id: string;
  /** Local date as YYYY-MM-DD, so the phone and the desktop agree. */
  date: string;
  /** Local time as HH:MM. */
  time: string;
  note: string;
  status: PlanStatus;
  videoUrl: string;
  createdAt: number;
};

type StoreShape = {
  version: 1;
  accounts: TrackedAccount[];
  settings: Settings;
  plan: PlanItem[];
};

const MAX_SNAPSHOTS = 200;

function emptyStore(): StoreShape {
  return { version: 1, accounts: [], settings: {}, plan: [] };
}

function load(): StoreShape {
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    return {
      version: 1,
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      settings: parsed.settings && typeof parsed.settings === "object" ? parsed.settings : {},
      plan: Array.isArray(parsed.plan) ? (parsed.plan as PlanItem[]) : [],
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
    language: s.language === "en" ? ("en" as const) : ("de" as const),
    aiBaseUrl: s.aiBaseUrl || ENV_DEFAULTS.aiBaseUrl,
    aiModel: s.aiModel || ENV_DEFAULTS.aiModel,
    aiApiKey: s.aiApiKey || ENV_DEFAULTS.aiApiKey,
    githubToken: s.githubToken || ENV_DEFAULTS.githubToken,
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
    language: eff.language,
    aiBaseUrl: eff.aiBaseUrl,
    aiModel: eff.aiModel,
    hasApiKey: Boolean(eff.aiApiKey),
    hasGithubToken: Boolean(eff.githubToken),
    githubTokenSource: data.settings.githubToken ? "ui" : ENV_DEFAULTS.githubToken ? "env" : "none",
    apiKeySource: data.settings.aiApiKey ? "ui" : ENV_DEFAULTS.aiApiKey ? "env" : "none",
    cookieSet: Boolean(eff.cookie),
    cookieSource: data.settings.cookie ? "ui" : ENV_DEFAULTS.cookie ? "env" : "none",
    minDelayMs: eff.minDelayMs,
    timezone: eff.timezone,
  };
}

export function updateSettings(patch: Settings) {
  const next: Settings = { ...data.settings };
  // The language is stored explicitly; deleting it would silently fall back to German.
  if (patch.language === "de" || patch.language === "en") {
    next.language = patch.language;
  }
  for (const key of ["aiBaseUrl", "aiModel", "aiApiKey", "githubToken", "cookie", "timezone"] as const) {
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

/* ------------------------------------------------------------------- plan */

const PLAN_LIMIT = 200;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function planId(): string {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function sortPlan(items: PlanItem[]): PlanItem[] {
  return [...items].sort((left, right) => `${left.date} ${left.time}`.localeCompare(`${right.date} ${right.time}`));
}

function trimPlan(items: PlanItem[]): PlanItem[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  const kept = items.filter((item) => item.date >= cutoffDate);
  return sortPlan(kept).slice(-PLAN_LIMIT);
}

export function listPlan(): PlanItem[] {
  return sortPlan(data.plan).map((item) => ({ ...item }));
}

export function addPlan(entries: { date?: string; time?: string; note?: string }[]): PlanItem[] {
  const created: PlanItem[] = [];
  for (const entry of entries.slice(0, 12)) {
    const date = String(entry.date ?? "");
    const time = String(entry.time ?? "");
    if (!DATE_PATTERN.test(date) || !TIME_PATTERN.test(time)) continue;
    created.push({
      id: planId(),
      date,
      time,
      note: String(entry.note ?? "").slice(0, 300),
      status: "planned",
      videoUrl: "",
      createdAt: Date.now(),
    });
  }
  data.plan = trimPlan([...data.plan, ...created]);
  if (created.length > 0) persist();
  return listPlan();
}

export function updatePlanEntry(
  id: string,
  patch: { status?: PlanStatus; note?: string; videoUrl?: string; date?: string; time?: string },
): PlanItem[] {
  const entry = data.plan.find((item) => item.id === id);
  if (entry) {
    if (patch.status === "planned" || patch.status === "done" || patch.status === "skipped") entry.status = patch.status;
    if (typeof patch.note === "string") entry.note = patch.note.slice(0, 300);
    if (typeof patch.videoUrl === "string") entry.videoUrl = patch.videoUrl.trim().slice(0, 300);
    if (typeof patch.date === "string" && DATE_PATTERN.test(patch.date)) entry.date = patch.date;
    if (typeof patch.time === "string" && TIME_PATTERN.test(patch.time)) entry.time = patch.time;
    persist();
  }
  return listPlan();
}

export function deletePlanEntry(id: string): PlanItem[] {
  const before = data.plan.length;
  data.plan = data.plan.filter((item) => item.id !== id);
  if (data.plan.length !== before) persist();
  return listPlan();
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
