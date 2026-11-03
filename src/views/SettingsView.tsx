import { useEffect, useState } from "react";
import { ApiError, api } from "../api";
import type { Provider, PublicSettings, Status } from "../types";
import { Alert, Badge, Section, Spinner } from "../components/ui";
import { formatDecimal } from "../format";

const normalizeUrl = (value: string) => value.trim().replace(/\/+$/, "").toLowerCase();

export function SettingsView({
  status,
  onStatusChange,
}: {
  status: Status | null;
  onStatusChange: () => void;
}) {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [cookie, setCookie] = useState("");
  const [delay, setDelay] = useState(1200);
  const [timezone, setTimezone] = useState("Europe/Berlin");
  const [models, setModels] = useState<string[]>([]);
  const [freeModels, setFreeModels] = useState<string[]>([]);
  const [freeOnly, setFreeOnly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error" | "info" | "warn"; text: string } | null>(null);

  useEffect(() => {
    api
      .settings()
      .then((data) => {
        setSettings(data);
        setBaseUrl(data.aiBaseUrl);
        setModel(data.aiModel);
        setDelay(data.minDelayMs);
        setTimezone(data.timezone);
      })
      .catch((caught: ApiError) => setMessage({ kind: "error", text: caught.message }));
    api
      .providers()
      .then((data) => setProviders(data.providers))
      .catch(() => setProviders([]));
  }, []);

  useEffect(() => {
    if (settings?.hasApiKey) void loadModels(true);
    // only when a key first appears – not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.hasApiKey]);

  const activeProvider = providers.find((provider) => normalizeUrl(provider.baseUrl) === normalizeUrl(baseUrl));
  const visibleModels = freeOnly ? models.filter((entry) => freeModels.includes(entry)) : models;

  function usePreset(provider: Provider, modelId: string, modelLabel: string) {
    setBaseUrl(provider.baseUrl);
    setModel(modelId);
    // The old list belongs to the previous provider.
    setModels([]);
    setFreeModels([]);
    setMessage({
      kind: "info",
      text: `${provider.name} · ${modelLabel} eingetragen. Key einfügen, „Modelle laden“ für die volle Auswahl, dann speichern.`,
    });
  }

  async function loadModels(silent = false) {
    setBusy("models");
    if (!silent) setMessage(null);
    try {
      // The key is passed along, so the list also works before saving it.
      const data = await api.models({
        aiBaseUrl: baseUrl.trim() || undefined,
        aiApiKey: apiKey.trim() || undefined,
      });
      setModels(data.models);
      setFreeModels(data.free ?? []);
      if (data.models.length === 0) {
        setMessage({ kind: "warn", text: "Der Anbieter hat keine Modelle gemeldet – Modellnamen bitte prüfen." });
      } else if (!silent) {
        const free = (data.free ?? []).length;
        setMessage({
          kind: "info",
          text: `${data.models.length} Modelle gefunden${free > 0 ? `, davon ${free} kostenlos` : ""} – jetzt im Dropdown auswählen und speichern.`,
        });
      }
    } catch (caught) {
      const apiError = caught as ApiError;
      setMessage({ kind: "error", text: `${apiError.message} ${apiError.hint}`.trim() });
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy("save");
    setMessage(null);
    try {
      const patch: Record<string, unknown> = { aiBaseUrl: baseUrl, aiModel: model, minDelayMs: delay, timezone };
      if (apiKey.trim() !== "") patch.aiApiKey = apiKey.trim();
      if (cookie.trim() !== "") patch.cookie = cookie.trim();
      const data = await api.saveSettings(patch);
      setSettings(data);
      setApiKey("");
      setCookie("");
      setMessage({ kind: "success", text: "Gespeichert." });
      onStatusChange();
    } catch (caught) {
      setMessage({ kind: "error", text: (caught as ApiError).message });
    } finally {
      setBusy(null);
    }
  }

  async function clearKey() {
    setBusy("key");
    try {
      const data = await api.saveSettings({ aiApiKey: "", cookie: "" });
      setSettings(data);
      setApiKey("");
      setMessage({ kind: "info", text: "Key und Cookie entfernt – .env-Werte greifen wieder." });
      onStatusChange();
    } catch (caught) {
      setMessage({ kind: "error", text: (caught as ApiError).message });
    } finally {
      setBusy(null);
    }
  }

  async function clearCache() {
    setBusy("cache");
    try {
      await api.clearCache();
      setMessage({ kind: "info", text: "Cache geleert – der nächste Scan liest wieder live von TikTok." });
      onStatusChange();
    } catch (caught) {
      setMessage({ kind: "error", text: (caught as ApiError).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack">
      {providers.length > 0 && (
        <Section
          title="Anbieter & kostenlose Modelle"
          subtitle="Ein Klick setzt Basis-URL und Modell. Kostenlose Keys gibt es bei Google AI Studio, Groq und OpenRouter – alles bleibt lokal."
        >
          <div className="provider-grid">
            {providers.map((provider) => {
              const isActive = activeProvider?.id === provider.id;
              return (
                <article key={provider.id} className={`provider${isActive ? " provider-active" : ""}`}>
                  <header className="provider-head">
                    <strong>{provider.name}</strong>
                    <Badge tone={provider.free ? "good" : "warn"}>{provider.free ? "kostenlos" : "kostenpflichtig"}</Badge>
                    {provider.recommended && <Badge tone="accent">Empfehlung</Badge>}
                    {isActive && <Badge tone="info">aktiv</Badge>}
                  </header>
                  <p className="muted small">{provider.freeNote}</p>
                  <p className="muted small">
                    <strong>Limits:</strong> {provider.limits}
                  </p>
                  <div className="provider-models">
                    {provider.models.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        className={`chip-btn${isActive && model === entry.id ? " chip-btn-active" : ""}`}
                        title={`${entry.note} · JSON-Qualität: ${entry.json}`}
                        onClick={() => usePreset(provider, entry.id, entry.label)}
                      >
                        {entry.label}
                      </button>
                    ))}
                  </div>
                  <div className="row gap-sm wrap provider-actions">
                    <a className="provider-key" href={provider.keyUrl} target="_blank" rel="noreferrer">
                      {provider.local ? "Ollama installieren ↗" : "Key holen ↗"}
                    </a>
                    <code className="provider-url">{provider.baseUrl}</code>
                  </div>
                </article>
              );
            })}
          </div>
          <Alert kind="info">
            ChatGPT im Browser ist gratis, die <strong>API von OpenAI ist es nicht</strong> – dort gibt es kein kostenloses
            Kontingent. Wirklich kostenlos sind Gemini, Groq, OpenRouter (Modelle mit <code>:free</code>) und Ollama lokal.
            Free-Tier-Inhalte dürfen bei Google und OpenRouter zum Verbessern der Modelle verwendet werden.
          </Alert>
        </Section>
      )}

      <Section
        title="KI-Anbieter"
        subtitle="Jede OpenAI-kompatible API. Key bleibt lokal auf diesem Rechner und wird nie an den Browser zurückgegeben."
      >
        <div className="grid-two">
          <label className="field">
            <span>Basis-URL</span>
            <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.openai.com/v1" spellCheck={false} />
            <small className="muted">
              {activeProvider ? `Erkannt: ${activeProvider.name}` : "Auch eigene Gateways und lokale Server möglich."}
            </small>
          </label>

          <div className="field">
            <span>
              Modell{" "}
              {settings && (
                <Badge tone={settings.hasApiKey ? "good" : "warn"}>{settings.hasApiKey ? `Key: ${settings.apiKeySource}` : "kein Key"}</Badge>
              )}
            </span>
            {visibleModels.length > 0 ? (
              <select
                value={model}
                onChange={(event) => {
                  setModel(event.target.value);
                  setMessage({ kind: "info", text: `Modell gewählt: ${event.target.value} – noch speichern.` });
                }}
              >
                {!visibleModels.includes(model) && <option value={model}>{model || "– Modell wählen –"}</option>}
                {visibleModels.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                    {freeModels.includes(entry) ? " · kostenlos" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={model}
                onChange={(event) => setModel(event.target.value)}
                list="model-list"
                placeholder="gpt-4o-mini"
                spellCheck={false}
              />
            )}
            <datalist id="model-list">
              {visibleModels.map((entry) => (
                <option key={entry} value={entry} />
              ))}
            </datalist>
            <small className="muted">
              {visibleModels.length > 0
                ? `${visibleModels.length} Modelle zur Auswahl${freeOnly ? " (nur kostenlose)" : ""}.`
                : "Key einfügen und „Modelle laden“ – dann erscheint hier die Auswahlliste."}
            </small>
            {freeModels.length > 0 && (
              <label className="inline-check">
                <input type="checkbox" checked={freeOnly} onChange={(event) => setFreeOnly(event.target.checked)} />
                nur kostenlose Modelle anzeigen
              </label>
            )}
          </div>

          <label className="field">
            <span>API-Key {settings?.hasApiKey && <small className="muted">(gesetzt – leer lassen zum Behalten)</small>}</span>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              onBlur={() => {
                if (apiKey.trim() !== "" && models.length === 0) void loadModels(true);
              }}
              placeholder={activeProvider?.local ? "nicht nötig bei lokalem Server" : "sk-…"}
              autoComplete="off"
              spellCheck={false}
            />
            <small className="muted">Nach dem Einfügen lädt die Modellliste automatisch – oder direkt „Modelle laden“.</small>
          </label>
          <div className="field align-end">
            <button className="btn" onClick={() => void loadModels()} disabled={busy !== null}>
              {busy === "models" ? <Spinner label="Lade…" /> : "Modelle laden"}
            </button>
          </div>
        </div>
      </Section>

      <Section title="Scraper" subtitle="Höflich bleiben: TikTok sperrt IPs, die zu schnell anfragen.">
        <div className="grid-two">
          <label className="field">
            <span>Mindestabstand zwischen Anfragen: {formatDecimal(delay / 1000, 1)} s</span>
            <input type="range" min={600} max={5000} step={100} value={delay} onChange={(event) => setDelay(Number(event.target.value))} />
            <small className="muted">20 Videos ≈ {Math.round((20 * delay) / 1000)} s. Bei „ratelimit triggered“ erhöhen.</small>
          </label>
          <label className="field">
            <span>Zeitzone für „beste Posting-Zeiten“</span>
            <input value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="Europe/Berlin" spellCheck={false} />
          </label>
          <label className="field span-2">
            <span>TikTok-Cookies (optional) {settings?.cookieSet && <Badge tone="good">gesetzt</Badge>}</span>
            <textarea
              value={cookie}
              onChange={(event) => setCookie(event.target.value)}
              rows={3}
              placeholder="sessionid=…; tt_csrf_token=…"
              spellCheck={false}
            />
            <small className="muted">
              Nur nötig, wenn TikTok blockt. Im Browser auf tiktok.com: DevTools → Application → Cookies → sessionid kopieren.
            </small>
          </label>
        </div>
      </Section>

      <div className="row gap wrap">
        <button className="btn btn-primary" onClick={save} disabled={busy !== null}>
          {busy === "save" ? <Spinner label="Speichere…" /> : "Einstellungen speichern"}
        </button>
        <button className="btn" onClick={clearCache} disabled={busy !== null}>
          Cache leeren
        </button>
        <button className="btn btn-ghost" onClick={clearKey} disabled={busy !== null}>
          Key & Cookie löschen
        </button>
      </div>

      {message && (
        <Alert kind={message.kind}>
          {message.text}
        </Alert>
      )}

      {status && (
        <Section title="Systemstatus">
          <ul className="kv">
            <li>
              <span>KI</span>
              <strong>{status.ai.configured ? `${status.ai.model} @ ${status.ai.baseUrl}` : "nicht konfiguriert"}</strong>
            </li>
            <li>
              <span>Scraper</span>
              <strong>
                {formatDecimal(status.scraping.minDelayMs / 1000, 1)} s Abstand · Cookie {status.scraping.cookieSet ? "aktiv" : "inaktiv"} · {status.scraping.cacheEntries} Cache-Einträge
              </strong>
            </li>
            <li>
              <span>Zeitzone</span>
              <strong>{status.timezone}</strong>
            </li>
            <li>
              <span>Erreichbarkeit</span>
              <strong>
                {status.server.localOnly ? `nur dieser Rechner (${status.server.host})` : `im Netzwerk offen (${status.server.host})`}
              </strong>
            </li>
            <li>
              <span>Version</span>
              <strong>{status.version}</strong>
            </li>
          </ul>
          <Alert kind="warn">
            Automatisiertes Auslesen von TikTok-Daten widerspricht den TikTok-Nutzungsbedingungen und kann zu Sperren führen. Nutze
            das Tool für eigene Accounts und für öffentlich sichtbare Marktforschung, mit niedriger Frequenz und auf eigenes Risiko.
          </Alert>
        </Section>
      )}
    </div>
  );
}
