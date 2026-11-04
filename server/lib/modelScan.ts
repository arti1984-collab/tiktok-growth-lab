import { aiConfig, listModelEntries, normalizeBaseUrl } from "./ai.ts";
import { postJson } from "./http.ts";
import { tr } from "./lang.ts";
import { findProvider } from "./providers.ts";

/**
 * Welche Modelle eines Anbieters kostenlos sind, sagt keine einheitliche API:
 * OpenRouter liefert Preise pro Token, Gemini und Groq haben ein Free-Tier fuer
 * alles, was sie listen, OpenAI gar keins. Der Scanner liest daher die Liste,
 * leitet "kostenlos" daraus ab und prueft die Kandidaten mit einer Anfrage von
 * einem Token, weil Listen auch Modelle enthalten, die der Key nicht darf.
 */

export type FreeModel = {
  id: string;
  free: boolean | null;
  works: boolean | null;
  ms: number | null;
  note: string;
};

export type FreeScan = {
  provider: string;
  baseUrl: string;
  rule: "pricing" | "tier" | "local" | "paid" | "unknown";
  checkedAt: number;
  total: number;
  probed: number;
  freeCount: number;
  models: FreeModel[];
};

const PROBE_LIMIT = 10;
const CACHE_MS = 10 * 60_000;

const cache = new Map<string, { at: number; value: FreeScan }>();

function isZero(value?: string): boolean {
  if (value === undefined || value === null || value === "") return false;
  const number = Number(value);
  return Number.isFinite(number) && number === 0;
}

async function probe(
  baseUrl: string,
  apiKey: string,
  model: string,
): Promise<{ works: boolean; ms: number; error?: string }> {
  const started = Date.now();
  try {
    const response = await postJson<unknown>(
      `${baseUrl}/chat/completions`,
      { model, messages: [{ role: "user", content: "ping" }], max_tokens: 1 },
      { accept: "application/json", ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
    );
    const ms = Date.now() - started;
    if (response.status === 200) return { works: true, ms };
    return { works: false, ms, error: `HTTP ${response.status}` };
  } catch (error) {
    return {
      works: false,
      ms: Date.now() - started,
      error: error instanceof Error ? error.message.slice(0, 80) : "",
    };
  }
}

export async function scanFreeModels(
  overrides: { baseUrl?: string; apiKey?: string } = {},
): Promise<FreeScan> {
  const stored = aiConfig();
  const baseUrl = normalizeBaseUrl(overrides.baseUrl?.trim() || stored.baseUrl);
  const apiKey = overrides.apiKey?.trim() || stored.apiKey;

  const cached = cache.get(baseUrl);
  if (!overrides.apiKey && cached && Date.now() - cached.at < CACHE_MS) return cached.value;

  const entries = await listModelEntries({ baseUrl, apiKey });
  const provider = findProvider(baseUrl);
  const hasPricing = entries.some(
    (entry) => entry.pricing?.prompt !== undefined || entry.pricing?.completion !== undefined,
  );

  const models: FreeModel[] = entries.map((entry) => {
    let free: boolean | null = null;
    let note = "";
    if (hasPricing) {
      free = isZero(entry.pricing?.prompt) && isZero(entry.pricing?.completion);
      note = free ? tr("Preis 0 pro Token", "price 0 per token") : tr("kostet pro Token", "costs per token");
    } else if (provider?.local) {
      free = true;
      note = tr("läuft lokal", "runs locally");
    } else if (provider?.free) {
      free = true;
      note = tr("Free-Tier des Anbieters", "provider free tier");
    } else if (provider) {
      free = false;
      note = tr("kein kostenloses Kontingent", "no free quota");
    } else if (entry.id.toLowerCase().endsWith(":free")) {
      free = true;
      note = tr("Kennung endet auf :free", "id ends with :free");
    }
    return { id: entry.id, free, works: null, ms: null, note };
  });

  // Nur was kostenlos sein kann, wird angefragt: jede Probe kostet ein Token.
  const candidates = models.filter((entry) => entry.free !== false).slice(0, PROBE_LIMIT);
  for (let index = 0; index < candidates.length; index += 3) {
    const batch = candidates.slice(index, index + 3);
    const results = await Promise.all(batch.map((entry) => probe(baseUrl, apiKey, entry.id)));
    results.forEach((result, position) => {
      const entry = batch[position];
      entry.works = result.works;
      entry.ms = result.ms;
      if (result.error) entry.note = `${entry.note ? `${entry.note}; ` : ""}${result.error}`;
    });
  }

  models.sort(
    (a, b) =>
      Number(b.works === true) - Number(a.works === true) ||
      Number(b.free === true) - Number(a.free === true) ||
      a.id.localeCompare(b.id),
  );

  const value: FreeScan = {
    provider: provider?.name ?? tr("eigener Anbieter", "own provider"),
    baseUrl,
    rule: hasPricing ? "pricing" : provider?.local ? "local" : provider?.free ? "tier" : provider ? "paid" : "unknown",
    checkedAt: Date.now(),
    total: models.length,
    probed: candidates.length,
    freeCount: models.filter((entry) => entry.free === true).length,
    models,
  };
  cache.set(baseUrl, { at: Date.now(), value });
  return value;
}
