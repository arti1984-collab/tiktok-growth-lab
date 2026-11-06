import { effectiveSettings, updateSettings } from "./store.ts";
import { tr } from "./lang.ts";
import { recordRateLimit } from "./stats.ts";

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class HttpError extends Error {
  status: number;
  body: string;
  constructor(status: number, message: string, body = "") {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Serializes every TikTok request and keeps a minimum gap between them.
 * TikTok answers with "ratelimit triggered" (or plain 429) when hammered,
 * so the whole scanner may only ever run one request at a time.
 */
class RateLimiter {
  private queue: Promise<unknown> = Promise.resolve();
  private last = 0;

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(async () => {
      const gap = effectiveSettings().minDelayMs;
      const wait = this.last + gap - Date.now();
      if (wait > 0) await sleep(wait);
      this.last = Date.now();
      return task();
    });
    this.queue = result.catch(() => undefined);
    return result;
  }
}

export const limiter = new RateLimiter();

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
];

function pickUserAgent(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 9973;
  return USER_AGENTS[hash % USER_AGENTS.length];
}

const HTML_ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
const JSON_ACCEPT = "application/json, text/plain, */*";

function buildHeaders(url: string, referer: string | undefined, accept: string): Record<string, string> {
  const settings = effectiveSettings();
  const headers: Record<string, string> = {
    "user-agent": pickUserAgent(url),
    "accept-language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
    accept,
    "cache-control": "no-cache",
    "sec-fetch-site": referer ? "same-origin" : "none",
  };
  if (referer) headers.referer = referer;
  if (settings.cookie) headers.cookie = settings.cookie;
  return headers;
}

async function fetchWithRetries(url: string, referer: string | undefined, accept: string): Promise<string> {
  const attempts = 3;
  let lastError: Error = new HttpError(0, tr("Unbekannter Fehler", "Unknown error"));

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: buildHeaders(url, referer, accept),
        redirect: "follow",
        signal: AbortSignal.timeout(25_000),
      });
      const text = await response.text();
      const throttled = response.status === 429 || /ratelimit triggered/i.test(text.slice(0, 120));

      if (throttled) {
        recordRateLimit();
        lastError = new HttpError(429, tr("TikTok drosselt die Anfragen (Rate-Limit).", "TikTok is throttling the requests (rate limit)."));
        if (attempt < attempts) {
          await sleep(4000 * attempt);
          continue;
        }
        throw lastError;
      }
      if (response.status === 403) {
        throw new HttpError(403, tr("TikTok blockt diese Anfrage (403).", "TikTok blocks this request (403)."));
      }
      if (!response.ok) {
        throw new HttpError(
          response.status,
          tr(`TikTok antwortet mit HTTP ${response.status}.`, `TikTok answers with HTTP ${response.status}.`),
          text.slice(0, 300),
        );
      }
      return text;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (err instanceof HttpError && (err.status === 403 || err.status === 404)) throw err;
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        lastError = new HttpError(
          0,
          tr("TikTok hat nicht innerhalb von 25 Sekunden geantwortet.", "TikTok did not answer within 25 seconds."),
        );
      } else {
        lastError = err;
      }
      if (attempt < attempts) {
        await sleep(1500 * attempt);
        continue;
      }
      throw lastError;
    }
  }
  throw lastError;
}

type CacheEntry = { expires: number; value: unknown };
const cache = new Map<string, CacheEntry>();

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await load();
  cache.set(key, { expires: Date.now() + ttlMs, value });
  return value;
}

export function clearCache() {
  cache.clear();
}

export function cacheSize() {
  return cache.size;
}

/**
 * The desktop app registers a real Chromium window here. It is the last resort
 * when TikTok answers with 403 or a captcha: the window loads the page like a
 * visitor, the user solves the captcha once, and the cookies it collected are
 * stored so the plain requests work again.
 */
type BrowserBridge = {
  fetchPage: (url: string) => Promise<{ html: string; cookie: string }>;
};

function browserBridge(): BrowserBridge | undefined {
  return (globalThis as { __tiktokBrowser?: BrowserBridge }).__tiktokBrowser;
}

export function browserFallbackAvailable(): boolean {
  return Boolean(browserBridge());
}

const BLOCK_PATTERN = /captcha|verify you are human|unusual traffic|access denied|ratelimit triggered/i;

function wantsBrowser(error: unknown): boolean {
  if (error instanceof HttpError && (error.status === 403 || error.status === 429)) return true;
  return error instanceof Error && BLOCK_PATTERN.test(error.message);
}

/** Loads a page through the Electron window, mostly for the diagnostics route. */
export async function browserProbe(url: string): Promise<{ htmlLength: number; cookieNames: string[] } | null> {
  const bridge = browserBridge();
  if (!bridge) return null;
  const page = await bridge.fetchPage(url);
  return {
    htmlLength: page.html.length,
    cookieNames: page.cookie
      .split(";")
      .map((part) => part.split("=")[0].trim())
      .filter(Boolean)
      .slice(0, 15),
  };
}

/** Fetches a TikTok page politely (throttled + retried + cached). */
export async function fetchHtml(url: string, referer?: string): Promise<string> {
  const ttl = effectiveSettings().cacheTtlMs;
  try {
    return await cached(`html:${url}`, ttl, () => limiter.run(() => fetchWithRetries(url, referer, HTML_ACCEPT)));
  } catch (error) {
    const bridge = browserBridge();
    if (!bridge || !wantsBrowser(error)) throw error;
    const page = await bridge.fetchPage(url);
    if (page.cookie) updateSettings({ cookie: page.cookie });
    cache.set(`html:${url}`, { expires: Date.now() + ttl, value: page.html });
    return page.html;
  }
}

/**
 * JSON from TikTok's own API. Same throttle, retries and cache as pages, so a
 * scan never fires more requests than the rate limit allows.
 */
export async function fetchJson<T>(url: string, referer?: string): Promise<T> {
  const ttl = effectiveSettings().cacheTtlMs;
  return cached(`json:${url}`, ttl, () =>
    limiter.run(async () => {
      const text = await fetchWithRetries(url, referer, JSON_ACCEPT);
      return JSON.parse(text) as T;
    }),
  );
}

/** JSON request for OpenAI-compatible endpoints – no TikTok throttling. */
export async function postJson<T>(
  url: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<{ status: number; data: T | null; text: string }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await response.text();
  let data: T | null = null;
  try {
    data = JSON.parse(text) as T;
  } catch {
    data = null;
  }
  return { status: response.status, data, text };
}

export async function getJson<T>(url: string, headers: Record<string, string>): Promise<{ status: number; data: T | null; text: string }> {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
  const text = await response.text();
  let data: T | null = null;
  try {
    data = JSON.parse(text) as T;
  } catch {
    data = null;
  }
  return { status: response.status, data, text };
}
