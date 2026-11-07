import fs from "node:fs";
import { ENV_DEFAULTS, STORE_FILE } from "../config.ts";
import { normalizeGoals, removeGoal, upsertGoal, type Goal } from "./goals.ts";
import { loadJsonStore, writeJsonStore } from "./storeFile.ts";
import type { Metrics } from "./metrics.ts";
import type { Profile, Video } from "./tiktok.ts";

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
  /** Nur noch Rueckfall ohne sicheren Speicher (Web-Betrieb). */
  aiApiKey?: string;
  /** Nur noetig, wenn das Release-Repo privat ist. */
  githubToken?: string;
  cookie?: string;
  minDelayMs?: number;
  timezone?: string;
  /** Alt: ein Ziel ohne Profil. Bleibt als Vorlage, bis eines gespeichert wird. */
  goalFollowers?: number;
  goalDate?: string;
  /** Ein Ziel pro Profil, damit Wachstum dazugehoert. */
  goals?: Goal[];
};

/** Was die Oberflaeche schicken darf: Einstellungen plus die Ziel-Aktionen. */
export type SettingsPatch = Settings & {
  goal?: { handle: string; followers: number; date: string; startFollowers?: number };
  removeGoal?: string;
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
  /** Wann der Post wirklich rausging, 0 wenn unbekannt. */
  postedAt: number;
  /** Zahlen von Hand, falls der naechste Scan den Post noch nicht kennt. */
  actualViews: number;
  actualLikes: number;
};

/** Letzter Scan eines Kontos, damit Analyse und KI-Kontext einen Neustart ueberleben. */
export type StoredScan = {
  profile: Profile;
  videos: Video[];
  metrics: Metrics;
  warnings: string[];
  durationMs: number;
  scannedAt: number;
  timezone: string;
};

type StoreShape = {
  version: 2;
  accounts: TrackedAccount[];
  settings: Settings;
  plan: PlanItem[];
  scans: Record<string, StoredScan>;
};

/** Was in der Exportdatei steht: keine Schluessel, keine Cookies, kein Token. */
export type DataExport = {
  app: "tiktok-growth-lab";
  format: 1;
  exportedAt: number;
  accounts: TrackedAccount[];
  plan: PlanItem[];
  scans: Record<string, StoredScan>;
  settings: {
    language?: "de" | "en";
    aiBaseUrl?: string;
    aiModel?: string;
    timezone?: string;
    minDelayMs?: number;
    goals?: Goal[];
  };
};

export class ImportError extends Error {
  code = "INVALID_EXPORT";
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

const MAX_SNAPSHOTS = 200;
const MAX_SCANS = 5;
const MAX_ACCOUNTS = 200;
const STORE_VERSION = 2;
const BACKUP_FILE = `${STORE_FILE}.bak`;

function emptyStore(): StoreShape {
  return { version: STORE_VERSION, accounts: [], settings: {}, plan: [], scans: {} };
}

/** Ein Eintrag aus Version 1 bekommt die neuen Felder, ohne Daten zu verlieren. */
function normalizePlanItem(raw: Partial<PlanItem>): PlanItem {
  return {
    id: String(raw.id ?? ""),
    date: typeof raw.date === "string" ? raw.date : "",
    time: typeof raw.time === "string" ? raw.time : "",
    note: typeof raw.note === "string" ? raw.note : "",
    status: raw.status === "done" || raw.status === "skipped" ? raw.status : "planned",
    videoUrl: typeof raw.videoUrl === "string" ? raw.videoUrl : "",
    createdAt: Number(raw.createdAt) || Date.now(),
    postedAt: Number(raw.postedAt) || 0,
    actualViews: Number(raw.actualViews) || 0,
    actualLikes: Number(raw.actualLikes) || 0,
  };
}

function normalizeSnapshot(raw: unknown): Snapshot | null {
  const entry = (raw ?? {}) as Partial<Snapshot>;
  const at = Number(entry.at);
  const followers = Number(entry.followers);
  if (!Number.isFinite(at) || at <= 0 || !Number.isFinite(followers)) return null;
  return {
    at,
    followers,
    following: Number(entry.following) || 0,
    hearts: Number(entry.hearts) || 0,
    videos: Number(entry.videos) || 0,
    engagementRate: typeof entry.engagementRate === "number" ? entry.engagementRate : null,
    score: typeof entry.score === "number" ? entry.score : null,
  };
}

function normalizeAccount(raw: unknown): TrackedAccount | null {
  const entry = (raw ?? {}) as Partial<TrackedAccount>;
  const handle = typeof entry.handle === "string" ? entry.handle.trim().replace(/^@/, "") : "";
  if (!handle) return null;
  return {
    handle,
    nickname: typeof entry.nickname === "string" ? entry.nickname : handle,
    avatar: typeof entry.avatar === "string" ? entry.avatar : "",
    addedAt: Number(entry.addedAt) || Date.now(),
    snapshots: Array.isArray(entry.snapshots)
      ? entry.snapshots.map(normalizeSnapshot).filter((snapshot): snapshot is Snapshot => snapshot !== null)
      : [],
  };
}

function normalizeStoredScan(raw: unknown): StoredScan | null {
  const entry = (raw ?? {}) as Partial<StoredScan>;
  const handle = typeof entry.profile?.handle === "string" ? entry.profile.handle : "";
  const scannedAt = Number(entry.scannedAt);
  if (!handle || !Number.isFinite(scannedAt) || scannedAt <= 0) return null;
  return {
    profile: entry.profile as Profile,
    videos: Array.isArray(entry.videos) ? entry.videos : [],
    metrics: entry.metrics as Metrics,
    warnings: Array.isArray(entry.warnings) ? entry.warnings.filter((warning) => typeof warning === "string") : [],
    durationMs: Number(entry.durationMs) || 0,
    scannedAt,
    timezone: typeof entry.timezone === "string" ? entry.timezone : ENV_DEFAULTS.timezone,
  };
}

/** Nur die juengsten Scans aufheben, sonst waechst die Datendatei unbegrenzt. */
function trimScans(scans: Record<string, StoredScan>): Record<string, StoredScan> {
  return Object.fromEntries(
    Object.entries(scans)
      .sort(([, left], [, right]) => right.scannedAt - left.scannedAt)
      .slice(0, MAX_SCANS),
  );
}

function normalizeStore(raw: unknown): { data: StoreShape; migrated: boolean } {
  const parsed = (raw ?? {}) as Partial<StoreShape>;
  const scans: Record<string, StoredScan> = {};
  if (parsed.scans && typeof parsed.scans === "object") {
    for (const value of Object.values(parsed.scans)) {
      const scan = normalizeStoredScan(value);
      if (scan) scans[scan.profile.handle.toLowerCase()] = scan;
    }
  }
  return {
    data: {
      version: STORE_VERSION,
      accounts: Array.isArray(parsed.accounts)
        ? parsed.accounts.map(normalizeAccount).filter((account): account is TrackedAccount => account !== null)
        : [],
      settings: parsed.settings && typeof parsed.settings === "object" ? parsed.settings : {},
      plan: Array.isArray(parsed.plan) ? parsed.plan.map(normalizePlanItem) : [],
      scans: trimScans(scans),
    },
    migrated: parsed.version !== STORE_VERSION,
  };
}

const loaded = loadJsonStore<StoreShape>({
  file: STORE_FILE,
  backup: BACKUP_FILE,
  empty: emptyStore,
  normalize: normalizeStore,
});

if (loaded.usedBackup) {
  console.warn(`[store] ${STORE_FILE} war unlesbar (${loaded.error}), Daten kommen aus der Sicherung.`);
}

/**
 * Der API-Key liegt in der Desktop-App verschluesselt neben der Datendatei.
 * Ohne diesen Empfaenger (Web-Betrieb) bleibt er wie bisher in store.json.
 */
type SecretsBridge = { read: () => string; write: (value: string) => boolean; clear: () => void };
const secretsBridge = (globalThis as { __tiktokSecrets?: SecretsBridge }).__tiktokSecrets;

function readSecureKey(): string {
  if (!secretsBridge) return "";
  try {
    return secretsBridge.read();
  } catch {
    return "";
  }
}

let secureKey = readSecureKey();
let data: StoreShape = loaded.data;
let saveTimer: NodeJS.Timeout | null = null;

function persistNow() {
  try {
    writeJsonStore(STORE_FILE, BACKUP_FILE, data);
  } catch (error) {
    console.error("[store] could not save:", (error as Error).message);
  }
}

function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 150);
}

/** Schreibt sofort, damit Tests und das Beenden nichts verlieren. */
export function flushPersist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  persistNow();
}

// Ein alter Key in der Datendatei wandert beim ersten Start in den sicheren Speicher.
if (data.settings.aiApiKey && secretsBridge) {
  try {
    if (secretsBridge.write(data.settings.aiApiKey)) {
      secureKey = data.settings.aiApiKey;
      delete data.settings.aiApiKey;
      persistNow();
    }
  } catch {
    // Dann bleibt der Key eben in der Datendatei.
  }
}

// Ein altes store.json bekommt beim Start einmal die neuen Felder.
if (loaded.migrated) persistNow();

export function getSettings(): Settings {
  return { ...data.settings };
}

export function effectiveSettings() {
  const s = data.settings;
  return {
    language: s.language === "en" ? ("en" as const) : ("de" as const),
    aiBaseUrl: s.aiBaseUrl || ENV_DEFAULTS.aiBaseUrl,
    aiModel: s.aiModel || ENV_DEFAULTS.aiModel,
    aiApiKey: s.aiApiKey || secureKey || ENV_DEFAULTS.aiApiKey,
    githubToken: s.githubToken || ENV_DEFAULTS.githubToken,
    cookie: s.cookie || ENV_DEFAULTS.cookie,
    minDelayMs: Number(s.minDelayMs && s.minDelayMs > 0 ? s.minDelayMs : ENV_DEFAULTS.minDelayMs),
    cacheTtlMs: ENV_DEFAULTS.cacheTtlMs,
    timezone: s.timezone || ENV_DEFAULTS.timezone,
    goalFollowers: Number(s.goalFollowers && s.goalFollowers > 0 ? Math.round(s.goalFollowers) : 0),
    goalDate: s.goalDate || "",
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
    apiKeySource: data.settings.aiApiKey || secureKey ? "ui" : ENV_DEFAULTS.aiApiKey ? "env" : "none",
    hasGithubToken: Boolean(eff.githubToken),
    githubTokenSource: data.settings.githubToken ? "ui" : ENV_DEFAULTS.githubToken ? "env" : "none",
    cookieSet: Boolean(eff.cookie),
    cookieSource: data.settings.cookie ? "ui" : ENV_DEFAULTS.cookie ? "env" : "none",
    minDelayMs: eff.minDelayMs,
    timezone: eff.timezone,
    goalFollowers: eff.goalFollowers,
    goalDate: eff.goalDate,
    goals: normalizeGoals(data.settings.goals),
  };
}

export function updateSettings(patch: SettingsPatch) {
  const next: Settings = { ...data.settings };
  // The language is stored explicitly; deleting it would silently fall back to German.
  if (patch.language === "de" || patch.language === "en") {
    next.language = patch.language;
  }
  for (const key of ["aiBaseUrl", "aiModel", "githubToken", "cookie", "timezone", "goalDate"] as const) {
    const value = patch[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    // empty string clears the override and falls back to .env
    if (trimmed === "") delete next[key];
    else next[key] = trimmed;
  }
  if (typeof patch.aiApiKey === "string") {
    const trimmed = patch.aiApiKey.trim();
    delete next.aiApiKey;
    if (trimmed === "") {
      secureKey = "";
      try {
        secretsBridge?.clear();
      } catch {
        // Ohne sicheren Speicher war da nichts zu loeschen.
      }
    } else if (secretsBridge && secretsBridge.write(trimmed)) {
      secureKey = trimmed;
    } else {
      // Web-Betrieb oder kein Schluesselspeicher: bleibt in der Datendatei.
      secureKey = "";
      next.aiApiKey = trimmed;
    }
  }
  if (typeof patch.goalFollowers === "number" && Number.isFinite(patch.goalFollowers)) {
    const goal = Math.round(patch.goalFollowers);
    if (goal > 0) next.goalFollowers = goal;
    else delete next.goalFollowers;
  }
  if (patch.goal && typeof patch.goal === "object") {
    next.goals = upsertGoal(next.goals, patch.goal);
  }
  if (typeof patch.removeGoal === "string" && patch.removeGoal.trim() !== "") {
    next.goals = removeGoal(next.goals, patch.removeGoal);
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
      postedAt: 0,
      actualViews: 0,
      actualLikes: 0,
    });
  }
  data.plan = trimPlan([...data.plan, ...created]);
  if (created.length > 0) persist();
  return listPlan();
}

export function updatePlanEntry(
  id: string,
  patch: {
    status?: PlanStatus;
    note?: string;
    videoUrl?: string;
    date?: string;
    time?: string;
    postedAt?: number;
    actualViews?: number;
    actualLikes?: number;
  },
): PlanItem[] {
  const entry = data.plan.find((item) => item.id === id);
  if (entry) {
    if (patch.status === "planned" || patch.status === "done" || patch.status === "skipped") entry.status = patch.status;
    if (typeof patch.postedAt === "number" && Number.isFinite(patch.postedAt)) entry.postedAt = Math.max(0, Math.round(patch.postedAt));
    if (typeof patch.actualViews === "number" && Number.isFinite(patch.actualViews)) entry.actualViews = Math.max(0, Math.round(patch.actualViews));
    if (typeof patch.actualLikes === "number" && Number.isFinite(patch.actualLikes)) entry.actualLikes = Math.max(0, Math.round(patch.actualLikes));
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

/* -------------------------------------------------------------- watchlist */

export function listAccounts(): TrackedAccount[] {
  return data.accounts.map((account) => ({ ...account, snapshots: [...account.snapshots] }));
}

function handleKey(handle: string): string {
  return handle.trim().replace(/^@/, "").toLowerCase();
}

export function findAccount(handle: string): TrackedAccount | undefined {
  const key = handleKey(handle);
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
  data.accounts = data.accounts.slice(-MAX_ACCOUNTS);
  persist();
  return account;
}

export function untrackAccount(handle: string): boolean {
  const key = handleKey(handle);
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

/* ------------------------------------------------------------------- scans */

/** Die letzten Scans, neueste zuerst. Sie halten Analyse und KI-Kontext am Leben. */
export function listStoredScans(): StoredScan[] {
  return Object.values(data.scans).sort((left, right) => right.scannedAt - left.scannedAt);
}

export function saveStoredScan(scan: StoredScan) {
  data.scans = trimScans({ ...data.scans, [scan.profile.handle.toLowerCase()]: scan });
  persist();
}

/* --------------------------------------------------------- export / import */

export function exportData(): DataExport {
  const s = data.settings;
  return {
    app: "tiktok-growth-lab",
    format: 1,
    exportedAt: Date.now(),
    accounts: listAccounts(),
    plan: listPlan(),
    scans: { ...data.scans },
    settings: {
      language: s.language,
      aiBaseUrl: s.aiBaseUrl,
      aiModel: s.aiModel,
      timezone: s.timezone,
      minDelayMs: s.minDelayMs,
      goals: normalizeGoals(s.goals),
    },
  };
}

/**
 * Ersetzt Messreihen, Plan und Scans durch den Inhalt der Datei. Schluessel,
 * Cookies und Token bleiben, wie sie sind: eine fremde Datei darf sie nicht
 * setzen. Vorher sichert writeJsonStore den alten Stand.
 */
export function importData(input: unknown): { accounts: number; plan: number; scans: number } {
  const source = (input ?? {}) as Partial<DataExport>;
  if (source.app !== "tiktok-growth-lab" || !Array.isArray(source.accounts) || !Array.isArray(source.plan)) {
    throw new ImportError("Datei ist kein Export von TikTok Growth Lab.");
  }
  const accounts = source.accounts
    .map(normalizeAccount)
    .filter((account): account is TrackedAccount => account !== null)
    .slice(0, MAX_ACCOUNTS);
  const plan = source.plan
    .map(normalizePlanItem)
    .filter((item) => DATE_PATTERN.test(item.date) && TIME_PATTERN.test(item.time));
  const scans: Record<string, StoredScan> = {};
  if (source.scans && typeof source.scans === "object") {
    for (const value of Object.values(source.scans)) {
      const scan = normalizeStoredScan(value);
      if (scan) scans[scan.profile.handle.toLowerCase()] = scan;
    }
  }

  const incoming = (source.settings ?? {}) as DataExport["settings"];
  const settings: Settings = { ...data.settings };
  if (incoming.language === "de" || incoming.language === "en") settings.language = incoming.language;
  for (const key of ["aiBaseUrl", "aiModel", "timezone"] as const) {
    const value = incoming[key];
    if (typeof value === "string" && value.trim() !== "") settings[key] = value.trim();
  }
  if (typeof incoming.minDelayMs === "number" && Number.isFinite(incoming.minDelayMs)) {
    settings.minDelayMs = Math.max(400, Math.min(10_000, Math.round(incoming.minDelayMs)));
  }
  if (Array.isArray(incoming.goals)) settings.goals = normalizeGoals(incoming.goals);

  data = { version: STORE_VERSION, accounts, settings, plan: trimPlan(plan), scans: trimScans(scans) };
  persistNow();
  return { accounts: accounts.length, plan: data.plan.length, scans: Object.keys(data.scans).length };
}

/* ------------------------------------------------------------------- house */

/** Was die Oberflaeche ueber die Datendatei wissen darf. */
export function storeInfo() {
  let backupAt: number | null = null;
  let size = 0;
  try {
    backupAt = fs.statSync(BACKUP_FILE).mtimeMs;
  } catch {
    backupAt = null;
  }
  try {
    size = fs.statSync(STORE_FILE).size;
  } catch {
    size = 0;
  }
  return {
    file: STORE_FILE,
    backup: BACKUP_FILE,
    backupAt,
    size,
    recoveredFromBackup: loaded.usedBackup,
    brokenFile: loaded.brokenFile,
    accounts: data.accounts.length,
    measurements: data.accounts.reduce((sum, account) => sum + account.snapshots.length, 0),
    plan: data.plan.length,
    scans: Object.keys(data.scans).length,
  };
}
