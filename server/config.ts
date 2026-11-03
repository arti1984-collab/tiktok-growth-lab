import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

/**
 * ROOT points at the folder that holds `dist/` and `.env`. The desktop build
 * passes it in via APP_ROOT, because there the bundled server lives in
 * build/server/ instead of server/ next to the project root.
 */
export const ROOT = process.env.APP_ROOT
  ? path.resolve(process.env.APP_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

dotenv.config({ path: path.join(ROOT, ".env"), quiet: true });

/** Writable data folder – the desktop build stores it in the user profile. */
export const DATA_DIR = process.env.APP_DATA_DIR ? path.resolve(process.env.APP_DATA_DIR) : path.join(ROOT, "data");
export const STORE_FILE = path.join(DATA_DIR, "store.json");
export const DIST_DIR = path.join(ROOT, "dist");

const requestedPort = Number(process.env.PORT);
export const PORT = Number.isFinite(requestedPort) && requestedPort > 0 ? requestedPort : 8787;

/**
 * Loopback only by default: the dashboard has no login, so it must never be
 * reachable from the LAN or the internet. Set HOST=0.0.0.0 explicitly if you
 * really want that (not recommended).
 */
const requestedHost = (process.env.HOST || "").trim();
export const HOST = requestedHost || "127.0.0.1";

export function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "localhost";
}

export const IS_DEV = process.env.APP_ENV === "development";

/**
 * Values from .env. They act as defaults for every setting that can also be
 * changed in the UI (which stores its own values in data/store.json).
 */
export const ENV_DEFAULTS = {
  aiBaseUrl: (process.env.AI_BASE_URL || "https://api.openai.com/v1").trim(),
  aiModel: (process.env.AI_MODEL || "gpt-4o-mini").trim(),
  aiApiKey: (process.env.AI_API_KEY || "").trim(),
  cookie: (process.env.TIKTOK_COOKIE || "").trim(),
  minDelayMs: Number(process.env.SCRAPE_MIN_DELAY_MS || 1200),
  cacheTtlMs: Number(process.env.SCRAPE_CACHE_TTL_MS || 900_000),
  timezone: process.env.TIMEZONE || "Europe/Berlin",
};
