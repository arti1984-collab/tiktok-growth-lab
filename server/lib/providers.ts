/**
 * Curated list of AI providers that can be used with this app. Every entry is
 * OpenAI-compatible, so no extra SDK is needed. Free tiers and model names
 * change often – the UI therefore always shows "Modelle laden" next to the
 * presets, which asks the provider what it really serves right now.
 *
 * Checked against the providers' own docs and the live OpenRouter model list
 * (2026-11): Gemini, Groq and OpenRouter have real free tiers; OpenAI does not.
 */

export type ProviderModel = {
  id: string;
  label: string;
  note: string;
  /** How reliably the model answers with clean JSON (matters for the KI-Studio). */
  json: "gut" | "ok";
};

export type Provider = {
  id: string;
  name: string;
  baseUrl: string;
  keyUrl: string;
  free: boolean;
  recommended?: boolean;
  local?: boolean;
  freeNote: string;
  limits: string;
  models: ProviderModel[];
};

export const PROVIDERS: Provider[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyUrl: "https://aistudio.google.com/apikey",
    free: true,
    recommended: true,
    freeNote:
      "Dauerhafter Free-Tier ohne Kreditkarte – die großzügigste kostenlose Option. Google darf Inhalte aus dem Free-Tier zum Verbessern der eigenen Produkte nutzen, also keine Kundendaten hineingeben.",
    limits: "Tageslimits je Modell (in AI Studio sichtbar), typisch 10–250 Anfragen pro Tag",
    models: [
      { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", note: "Bester Allrounder im Free-Tier, 1M Kontext", json: "gut" },
      { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash", note: "Vorgänger, oft mit mehr Spielraum", json: "gut" },
      { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", note: "Schnell und sparsam", json: "ok" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", note: "Älter, aber sehr stabil", json: "ok" },
    ],
  },
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    keyUrl: "https://console.groq.com/keys",
    free: true,
    freeNote: "Free-Plan ohne Kreditkarte. Antworten kommen sehr schnell, weil offene Modelle auf spezieller Hardware laufen.",
    limits: "30 Anfragen/Minute · 1.000 Anfragen/Tag · 8.000 Token/Minute",
    models: [
      { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B", note: "Stärkstes Gratis-Modell bei Groq", json: "gut" },
      { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B", note: "Kleiner und schneller", json: "ok" },
      { id: "qwen/qwen3.8-27b", label: "Qwen 3.8 27B", note: "Gutes Deutsch", json: "ok" },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    keyUrl: "https://openrouter.ai/keys",
    free: true,
    freeNote:
      "Ein Key für sehr viele Modelle. Alles, was auf :free endet, kostet nichts – die kostenlose Auswahl rotiert, deshalb lohnt „Modelle laden“.",
    limits: "20 Anfragen/Minute · 50 Anfragen/Tag (1.000/Tag ab 10 $ Guthaben)",
    models: [
      { id: "nvidia/nemotron-3.5-lightning:free", label: "Nemotron 3.5 Lightning", note: "Schnell, 1M Kontext", json: "ok" },
      { id: "google/gemma-4-31b-it:free", label: "Gemma 4 31B", note: "Google-Modell, solides Deutsch", json: "ok" },
      { id: "thinkingmachines/inkling:free", label: "Inkling", note: "Großer Kontext", json: "ok" },
      { id: "nvidia/nemotron-3-ultra-550b-a55b:free", label: "Nemotron 3 Ultra", note: "Größtes Gratis-Modell dort", json: "ok" },
    ],
  },
  {
    id: "ollama",
    name: "Ollama (lokal)",
    baseUrl: "http://localhost:11434/v1",
    keyUrl: "https://ollama.com/download",
    free: true,
    local: true,
    freeNote:
      "Läuft auf deinem eigenen Rechner: kein Key, keine Tageslimits, keine Datenweitergabe. Dafür braucht es RAM und die Qualität hängt vom Modell ab.",
    limits: "Nur durch deine Hardware begrenzt",
    models: [
      { id: "qwen3:8b", label: "Qwen 3 8B", note: "Bester Kompromiss aus Qualität und Größe", json: "ok" },
      { id: "llama3.2", label: "Llama 3.2", note: "Klein, läuft auch auf Laptops", json: "ok" },
      { id: "gemma3:12b", label: "Gemma 3 12B", note: "Braucht mehr RAM", json: "ok" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI (ChatGPT)",
    baseUrl: "https://api.openai.com/v1",
    keyUrl: "https://platform.openai.com/api-keys",
    free: false,
    freeNote:
      "Wichtig: ChatGPT im Browser ist gratis, die API ist es nicht. OpenAI hat kein kostenloses API-Kontingent – hier zahlst du pro Token.",
    limits: "Nur mit Guthaben (Pay-as-you-go)",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o mini", note: "Günstig und zuverlässig im JSON-Format", json: "gut" },
      { id: "gpt-4o", label: "GPT-4o", note: "Stärker, deutlich teurer", json: "gut" },
    ],
  },
];

export function findProvider(baseUrl: string): Provider | undefined {
  const normalized = baseUrl.trim().replace(/\/+$/, "").toLowerCase();
  return PROVIDERS.find((provider) => provider.baseUrl.toLowerCase() === normalized);
}

/** Ollama and other local servers do not need (and do not accept) a real key. */
export function isLocalBaseUrl(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0" || host === "[::1]";
  } catch {
    return false;
  }
}
