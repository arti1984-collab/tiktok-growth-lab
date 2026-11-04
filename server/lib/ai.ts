import { effectiveSettings } from "./store.ts";
import { getJson, postJson } from "./http.ts";
import { tr } from "./lang.ts";
import { isLocalBaseUrl } from "./providers.ts";

export type AiConfig = { baseUrl: string; model: string; apiKey: string; keyless: boolean };

export class AiError extends Error {
  code: "NO_KEY" | "AUTH" | "MODEL" | "RATE_LIMIT" | "OVERLOAD" | "PROVIDER" | "TIMEOUT";
  hint: string;
  constructor(code: AiError["code"], message: string, hint = "") {
    super(message);
    this.name = "AiError";
    this.code = code;
    this.hint = hint;
  }
}

export function aiConfig(): AiConfig {
  const settings = effectiveSettings();
  const baseUrl = settings.aiBaseUrl.replace(/\/+$/, "");
  return {
    baseUrl,
    model: settings.aiModel,
    apiKey: settings.aiApiKey,
    // Local servers (Ollama, LM Studio) need no key at all.
    keyless: isLocalBaseUrl(baseUrl),
  };
}

export function aiConfigured(): boolean {
  const config = aiConfig();
  return Boolean(config.apiKey) || config.keyless;
}

function authHeaders(config: AiConfig): Record<string, string> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;
  return headers;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function request<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/timeout|abort/i.test(message)) {
      throw new AiError(
        "TIMEOUT",
        tr("Der KI-Anbieter hat zu lange nicht geantwortet.", "The AI provider took too long to answer."),
        tr("Später erneut versuchen oder ein schnelleres Modell wählen.", "Try again later or pick a faster model."),
      );
    }
    throw new AiError(
      "PROVIDER",
      tr("Der KI-Anbieter ist nicht erreichbar.", "The AI provider cannot be reached."),
      tr(
        `Prüfe die Basis-URL unter Einstellungen (${message.slice(0, 120)}).`,
        `Check the base URL in the settings (${message.slice(0, 120)}).`,
      ),
    );
  }
}

type ProviderErrorBody = { error?: { message?: string; type?: string; status?: string } };

/** Providers disagree on the error shape (Gemini even returns an array). */
function providerMessage(data: unknown, text: string): string {
  const nodes: unknown[] = Array.isArray(data) ? data : [data];
  for (const node of nodes) {
    const message = (node as ProviderErrorBody)?.error?.message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return text.trim();
}

/** "high demand", "overloaded" and 503/529 mean: try again in a moment. */
function isOverload(status: number, message: string): boolean {
  if (status === 500 || status === 502 || status === 503 || status === 504 || status === 529) return true;
  return /high demand|overload|unavailable|temporar|try again later|capacity/i.test(message);
}

function mapHttpError(status: number, text: string): AiError {
  const detail = text.slice(0, 300);
  if (isOverload(status, detail)) {
    return new AiError(
      "OVERLOAD",
      tr(
        `Der KI-Anbieter ist gerade überlastet (HTTP ${status}).`,
        `The AI provider is overloaded right now (HTTP ${status}).`,
      ),
      tr(
        `Meist vorübergehend: in 30–60 Sekunden erneut versuchen, ein kleineres Modell wählen (z. B. "Flash-Lite") oder in den Einstellungen auf einen anderen kostenlosen Anbieter wechseln (Groq, OpenRouter). Anbieter-Meldung: ${detail || "keine"}`,
        `Usually temporary: try again in 30–60 seconds, pick a smaller model (for example "Flash-Lite") or switch to another free provider in the settings (Groq, OpenRouter). Provider message: ${detail || "none"}`,
      ),
    );
  }
  if (status === 401 || status === 403) {
    return new AiError(
      "AUTH",
      tr("Der API-Key wurde abgelehnt (401/403).", "The API key was rejected (401/403)."),
      tr("Prüfe den Key unter Einstellungen.", "Check the key in the settings."),
    );
  }
  if (status === 404) {
    return new AiError(
      "MODEL",
      tr("Modell oder Basis-URL nicht gefunden (404).", "Model or base URL not found (404)."),
      tr(
        "Prüfe AI_BASE_URL und den Modellnamen – über „Modelle laden“ siehst du die verfügbaren Modelle.",
        "Check the base URL and the model name – \"Load models\" shows what the provider offers.",
      ),
    );
  }
  if (status === 429) {
    return new AiError(
      "RATE_LIMIT",
      tr("Der KI-Anbieter drosselt gerade (429).", "The AI provider is throttling right now (429)."),
      tr(
        "Free-Tier-Limit erreicht (Groq/OpenRouter sind schnell ausgeschöpft). Kurz warten, Modell wechseln oder einen anderen kostenlosen Anbieter wählen.",
        "Free tier limit reached (Groq and OpenRouter run out quickly). Wait a moment, change the model or pick another free provider.",
      ),
    );
  }
  return new AiError(
    "PROVIDER",
    tr(`Der KI-Anbieter antwortet mit HTTP ${status}.`, `The AI provider answers with HTTP ${status}.`),
    detail,
  );
}

type ChatCompletion = {
  choices?: { message?: { content?: string } }[];
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; type?: string };
};

/**
 * Lists the models a provider serves. Overrides let the UI ask with a key that
 * the user has just typed but not saved yet.
 */
export async function listModels(overrides: { baseUrl?: string; apiKey?: string } = {}): Promise<string[]> {
  const stored = aiConfig();
  const baseUrl = (overrides.baseUrl?.trim() || stored.baseUrl).replace(/\/+$/, "");
  const config: AiConfig = {
    baseUrl,
    model: stored.model,
    apiKey: overrides.apiKey?.trim() || stored.apiKey,
    keyless: isLocalBaseUrl(baseUrl),
  };
  const { status, data, text } = await request(() =>
    getJson<{ data?: { id?: string }[] }>(`${config.baseUrl}/models`, authHeaders(config)),
  );
  if (status !== 200) throw mapHttpError(status, JSON.stringify(data ?? text));
  const models = (data?.data ?? []).map((entry) => entry.id).filter((id): id is string => Boolean(id));
  return models.sort((a, b) => a.localeCompare(b));
}

/** Providers drop requests under load; two quick retries fix most of those 503s. */
const RETRY_DELAYS_MS = [900, 2500];

export async function chat(
  messages: { role: "system" | "user"; content: string }[],
  options: { json?: boolean; temperature?: number; maxTokens?: number } = {},
): Promise<{ text: string; model: string; usage?: ChatCompletion["usage"] }> {
  const config = aiConfig();
  if (!config.apiKey && !config.keyless) {
    throw new AiError(
      "NO_KEY",
      tr("Kein KI-Key hinterlegt.", "No AI key stored."),
      tr(
        "Trage unter Einstellungen einen API-Key ein (oder setze AI_API_KEY in der .env). Kostenlose Keys gibt es bei Google AI Studio, Groq und OpenRouter – ohne Key funktionieren Scraping und Analyse trotzdem.",
        "Add an API key in the settings (or set AI_API_KEY in .env). Free keys are available at Google AI Studio, Groq and OpenRouter; scraping and analysis work without a key too.",
      ),
    );
  }

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 3000,
  };
  if (options.json) body.response_format = { type: "json_object" };

  const send = () => request(() => postJson<ChatCompletion>(`${config.baseUrl}/chat/completions`, body, authHeaders(config)));

  let response = await send();
  let lastMessage = providerMessage(response.data, response.text);

  // Retry overloaded providers (Gemini free tier answers 503 "high demand" a lot).
  for (const delay of RETRY_DELAYS_MS) {
    if (!isOverload(response.status, lastMessage)) break;
    await sleep(delay);
    response = await send();
    lastMessage = providerMessage(response.data, response.text);
  }

  // Some providers/older models reject response_format – retry without it.
  if (response.status === 400 && options.json && /response_format|json_object|unsupported|unknown/i.test(lastMessage)) {
    delete body.response_format;
    response = await send();
    lastMessage = providerMessage(response.data, response.text);
  }

  if (response.status !== 200) throw mapHttpError(response.status, lastMessage);

  const content = response.data?.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) {
    throw new AiError(
      "PROVIDER",
      tr("Der KI-Anbieter hat eine leere Antwort geliefert.", "The AI provider returned an empty answer."),
      lastMessage.slice(0, 300) ||
        tr("Oft ein Zeichen für Überlastung – bitte erneut versuchen.", "Often a sign of overload – please try again."),
    );
  }
  return { text: content, model: response.data?.model || config.model, usage: response.data?.usage };
}

/** Pulls the first JSON object/array out of a model answer (handles code fences and prose). */
export function extractJson(text: string): unknown | null {
  const cleaned = text
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // keep going
  }
  const start = cleaned.search(/[[{]/);
  if (start === -1) return null;
  const openChar = cleaned[start];
  const closeChar = openChar === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < cleaned.length; index += 1) {
    const char = cleaned[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') inString = !inString;
    if (inString) continue;
    if (char === openChar) depth += 1;
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, index + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
