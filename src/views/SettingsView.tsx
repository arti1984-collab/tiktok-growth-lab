import { useEffect, useState } from "react";
import { ApiError, api } from "../api";
import { useT } from "../lang";
import type { FreeScan, Provider, PublicSettings, Status, TokenProbe, UpdateInfo } from "../types";
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
  const t = useT();
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [cookie, setCookie] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [delay, setDelay] = useState(1200);
  const [timezone, setTimezone] = useState("Europe/Berlin");
  const [models, setModels] = useState<string[]>([]);
  const [freeModels, setFreeModels] = useState<string[]>([]);
  const [freeOnly, setFreeOnly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [tokenProbe, setTokenProbe] = useState<TokenProbe | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [scan, setScan] = useState<FreeScan | null>(null);
  const [scanning, setScanning] = useState(false);
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
    api
      .update()
      .then(setUpdate)
      .catch(() => setUpdate(null));
  }, []);

  // Solange die neue Datei laedt, zeigt die Karte den Fortschritt mit.
  const downloadState = update?.download?.state ?? null;
  const updateAvailable = update?.updateAvailable ?? false;
  useEffect(() => {
    if (!updateAvailable || downloadState === "ready") return;
    const timer = window.setInterval(() => {
      api.update().then(setUpdate).catch(() => undefined);
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [updateAvailable, downloadState]);

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
      text: t(
        `${provider.name} · ${modelLabel} eingetragen. Key einfügen, „Modelle laden“ für die volle Auswahl, dann speichern.`,
        `${provider.name} · ${modelLabel} filled in. Add the key, press "Load models" for the full list, then save.`,
      ),
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
        setMessage({
          kind: "warn",
          text: t(
            "Der Anbieter hat keine Modelle gemeldet – Modellnamen bitte prüfen.",
            "The provider reported no models, please check the model name.",
          ),
        });
      } else if (!silent) {
        const free = (data.free ?? []).length;
        setMessage({
          kind: "info",
          text: t(
            `${data.models.length} Modelle gefunden${free > 0 ? `, davon ${free} kostenlos` : ""} – jetzt im Dropdown auswählen und speichern.`,
            `${data.models.length} models found${free > 0 ? `, ${free} of them free` : ""}, pick one in the dropdown and save.`,
          ),
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
      if (githubToken.trim() !== "") patch.githubToken = githubToken.trim();
      const data = await api.saveSettings(patch);
      setSettings(data);
      setApiKey("");
      setCookie("");
      setGithubToken("");
      setMessage({ kind: "success", text: t("Gespeichert.", "Saved.") });
      onStatusChange();
    } catch (caught) {
      setMessage({ kind: "error", text: (caught as ApiError).message });
    } finally {
      setBusy(null);
    }
  }

  async function checkUpdate() {
    setCheckingUpdate(true);
    try {
      setUpdate(await api.update(true));
    } catch (caught) {
      setUpdate(null);
      setMessage({ kind: "error", text: (caught as ApiError).message });
    } finally {
      setCheckingUpdate(false);
    }
  }

  async function checkToken() {
    setBusy("token");
    setTokenProbe(null);
    try {
      // Das getippte Token zaehlt schon vor dem Speichern, sonst das gespeicherte.
      setTokenProbe(await api.probeGithubToken(githubToken.trim()));
    } catch (caught) {
      setMessage({ kind: "error", text: (caught as ApiError).message });
    } finally {
      setBusy(null);
    }
  }

  async function restart() {
    setRestarting(true);
    try {
      await api.restartUpdate();
    } catch (caught) {
      setRestarting(false);
      setMessage({ kind: "error", text: (caught as ApiError).message });
    }
  }

  async function checkFreeModels() {
    setScanning(true);
    setMessage(null);
    try {
      const data = await api.scanFree({ aiBaseUrl: baseUrl.trim(), aiApiKey: apiKey.trim() || undefined });
      setScan(data);
    } catch (caught) {
      setScan(null);
      setMessage({ kind: "error", text: (caught as ApiError).message });
    } finally {
      setScanning(false);
    }
  }

  async function chooseLanguage(language: "de" | "en") {
    setBusy("language");
    try {
      const data = await api.saveSettings({ language });
      setSettings(data);
      // The whole page follows the new language through the status refresh.
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
      setMessage({
        kind: "info",
        text: t("Key und Cookie entfernt – .env-Werte greifen wieder.", "Key and cookie removed, the .env values apply again."),
      });
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
      setMessage({
        kind: "info",
        text: t(
          "Cache geleert – der nächste Scan liest wieder live von TikTok.",
          "Cache cleared, the next scan reads live from TikTok again.",
        ),
      });
      onStatusChange();
    } catch (caught) {
      setMessage({ kind: "error", text: (caught as ApiError).message });
    } finally {
      setBusy(null);
    }
  }

  const currentLanguage = settings?.language ?? "de";

  return (
    <div className="stack">
      <Section
        title={t("Sprache", "Language")}
        subtitle={t(
          "Gilt für die Oberfläche, die Anleitung und die Texte der KI. Die Wahl liegt in der Datendatei und gilt nach einem Neustart weiter.",
          "Applies to the interface, the guide and the texts the AI writes. The choice is stored in the data file and survives a restart.",
        )}
      >
        <div className="row gap-sm wrap">
          <button
            type="button"
            className={`chip-btn${currentLanguage === "de" ? " chip-btn-active" : ""}`}
            onClick={() => void chooseLanguage("de")}
            disabled={busy !== null}
          >
            Deutsch
          </button>
          <button
            type="button"
            className={`chip-btn${currentLanguage === "en" ? " chip-btn-active" : ""}`}
            onClick={() => void chooseLanguage("en")}
            disabled={busy !== null}
          >
            English
          </button>
          {busy === "language" && <Spinner label={t("Speichere…", "Saving…")} />}
        </div>
      </Section>

      <Section
        title={t("Updates", "Updates")}
        subtitle={t(
          "Prüft die neueste Veröffentlichung auf GitHub. Der Hinweis erscheint auch oben auf jeder Seite, sobald eine höhere Version bereitliegt.",
          "Checks the newest GitHub release. The notice also appears on top of every page as soon as a higher version is out.",
        )}
        actions={
          <button className="btn" onClick={() => void checkUpdate()} disabled={checkingUpdate}>
            {checkingUpdate ? <Spinner label={t("Prüfe…", "Checking…")} /> : t("Nach Updates suchen", "Check for updates")}
          </button>
        }
      >
        <ul className="kv">
          <li>
            <span>{t("Installiert", "Installed")}</span>
            <strong>{status?.version ?? "–"}</strong>
          </li>
          <li>
            <span>{t("Neueste veröffentlicht", "Newest published")}</span>
            <strong>{update?.latest ?? "–"}</strong>
          </li>
        </ul>

        <label className="field">
          <span>
            {t("GitHub-Token (nur bei privatem Repo)", "GitHub token (private repo only)")}{" "}
            {settings?.hasGithubToken && (
              <Badge tone="good">
                {t("gesetzt", "set")} · {settings.githubTokenSource}
              </Badge>
            )}
          </span>
          <input
            type="password"
            value={githubToken}
            onChange={(event) => {
              setGithubToken(event.target.value);
              // Ein Ergebnis gilt immer nur fuer das Token, das gerade im Feld steht.
              setTokenProbe(null);
            }}
            placeholder={settings?.hasGithubToken ? t("leer lassen zum Behalten", "leave empty to keep") : "github_pat_…"}
            autoComplete="off"
            spellCheck={false}
          />
          <small className="muted">
            {t(
              "Fein abgestuftes Token mit Lesezugriff auf Contents. Bleibt lokal in der Datendatei. Ohne Token findet die Prüfung in einem privaten Repo nichts.",
              "Fine-grained token with read access to contents. Stays local in the data file. Without a token the check finds nothing in a private repo.",
            )}
          </small>
        </label>

        <div className="row gap-sm wrap" style={{ marginBottom: 4 }}>
          <button className="btn btn-sm" onClick={() => void checkToken()} disabled={busy === "token"}>
            {busy === "token" ? <Spinner label={t("Prüfe…", "Checking…")} /> : t("Token prüfen", "Check token")}
          </button>
          {tokenProbe && (
            <Badge tone={tokenProbe.ok ? "good" : "warn"}>
              {tokenProbe.ok ? t("Token gültig", "Token valid") : t("Token abgelehnt", "Token rejected")}
            </Badge>
          )}
        </div>

        {tokenProbe && (
          <p className="muted small">
            {tokenProbe.repo}
            {tokenProbe.private ? ` · ${t("privat", "private")}` : ""}
            {tokenProbe.latest ? ` · ${t("neueste Version", "newest version")} ${tokenProbe.latest}` : ""} ·{" "}
            {tokenProbe.message}
          </p>
        )}

        {update?.error && <Alert kind="info">{update.error}</Alert>}

        {update && !update.error &&
          (update.updateAvailable ? (
            <Alert kind="info">
              <strong>
                {update.download?.state === "downloading"
                  ? t(
                      `Version ${update.latest} wird geladen, ${update.download.percent} %.`,
                      `Version ${update.latest} is downloading, ${update.download.percent} %.`,
                    )
                  : update.download?.state === "ready"
                    ? t(`Version ${update.latest} liegt bereit.`, `Version ${update.latest} is ready.`)
                    : t(`Version ${update.latest} ist verfügbar.`, `Version ${update.latest} is available.`)}
              </strong>
              <p className="muted small" style={{ marginTop: 6 }}>
                {update.download?.state === "ready"
                  ? t(
                      "Die neue Datei ersetzt die alte beim Beenden. Ein Neustart genügt.",
                      "The new file replaces the old one when the app quits. A restart is enough.",
                    )
                  : t(
                      "Die Datei lädt im Hintergrund. Danach genügt ein Neustart.",
                      "The file downloads in the background. A restart is enough afterwards.",
                    )}
              </p>
              <div className="row gap-sm wrap" style={{ marginTop: 8 }}>
                {update.download?.state === "ready" && (
                  <button className="btn btn-sm btn-primary" onClick={() => void restart()} disabled={restarting}>
                    {restarting ? t("Startet neu…", "Restarting…") : t("Jetzt neu starten", "Restart now")}
                  </button>
                )}
                {update.exe && update.download?.state !== "ready" && (
                  <a className="btn btn-sm" href={update.exe} target="_blank" rel="noreferrer">
                    {t("Windows-Datei", "Windows file")}
                  </a>
                )}
                {update.url && (
                  <a className="btn btn-sm btn-ghost" href={update.url} target="_blank" rel="noreferrer">
                    {t("Release-Seite", "Release page")}
                  </a>
                )}
              </div>
            </Alert>
          ) : (
            <p className="muted small">{t("Du nutzt die neueste Version.", "You are on the newest version.")}</p>
          ))}

      </Section>

      <Section
        title={t("Benachrichtigungen", "Notifications")}
        subtitle={t(
          "Meldung, wenn ein geplanter Post in den nächsten zwei Stunden fällig ist.",
          "A message when a planned post is due within the next two hours.",
        )}
      >
        <p className="muted small">
          {t(
            "Die Erinnerung erscheint immer als Zeile in der App. Zusätzlich als Systemmeldung, wenn der Browser es erlaubt.",
            "The reminder always appears as a line inside the app, plus a system message if the browser allows it.",
          )}
        </p>
        <div className="row gap-sm wrap">
          <button
            className="btn btn-sm"
            onClick={() => {
              if (!("Notification" in window)) return;
              void Notification.requestPermission();
            }}
            disabled={!("Notification" in window)}
          >
            {t("Systemmeldungen erlauben", "Allow system messages")}
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => {
              if (!("Notification" in window)) return;
              new Notification(t("TikTok Growth Lab", "TikTok Growth Lab"), {
                body: t("So sehen Erinnerungen aus.", "This is what reminders look like."),
              });
            }}
            disabled={!("Notification" in window) || Notification.permission !== "granted"}
          >
            {t("Testmeldung", "Test message")}
          </button>
        </div>
      </Section>

      {providers.length > 0 && (
        <Section
          title={t("Anbieter & kostenlose Modelle", "Providers & free models")}
          subtitle={t(
            "Ein Klick setzt Basis-URL und Modell. Kostenlose Keys gibt es bei Google AI Studio, Groq und OpenRouter – alles bleibt lokal.",
            "One click fills in base URL and model. Free keys are available at Google AI Studio, Groq and OpenRouter; everything stays local.",
          )}
        >
          <div className="provider-grid">
            {providers.map((provider) => {
              const isActive = activeProvider?.id === provider.id;
              return (
                <article key={provider.id} className={`provider${isActive ? " provider-active" : ""}`}>
                  <header className="provider-head">
                    <strong>{provider.name}</strong>
                    <Badge tone={provider.free ? "good" : "warn"}>{provider.free ? t("kostenlos", "free") : t("kostenpflichtig", "paid")}</Badge>
                    {provider.recommended && <Badge tone="accent">{t("Empfehlung", "recommended")}</Badge>}
                    {isActive && <Badge tone="info">{t("aktiv", "active")}</Badge>}
                  </header>
                  <p className="muted small">{provider.freeNote}</p>
                  <p className="muted small">
                    <strong>{t("Limits", "Limits")}:</strong> {provider.limits}
                  </p>
                  <div className="provider-models">
                    {provider.models.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        className={`chip-btn${isActive && model === entry.id ? " chip-btn-active" : ""}`}
                        title={`${entry.note} · ${t("JSON-Qualität", "JSON quality")}: ${entry.json}`}
                        onClick={() => usePreset(provider, entry.id, entry.label)}
                      >
                        {entry.label}
                      </button>
                    ))}
                  </div>
                  <div className="row gap-sm wrap provider-actions">
                    <a className="provider-key" href={provider.keyUrl} target="_blank" rel="noreferrer">
                      {provider.local ? t("Ollama installieren ↗", "Install Ollama ↗") : t("Key holen ↗", "Get a key ↗")}
                    </a>
                    <code className="provider-url">{provider.baseUrl}</code>
                  </div>
                </article>
              );
            })}
          </div>
          <Alert kind="info">
            {t("ChatGPT im Browser ist gratis, die ", "ChatGPT in the browser is free, the ")}
            <strong>{t("API von OpenAI ist es nicht", "OpenAI API is not")}</strong>
            {t(
              " – dort gibt es kein kostenloses Kontingent. Wirklich kostenlos sind Gemini, Groq, OpenRouter (Modelle mit ",
              " – there is no free quota there. Genuinely free are Gemini, Groq, OpenRouter (models with ",
            )}
            <code>:free</code>
            {t(
              ") und Ollama lokal. Free-Tier-Inhalte dürfen bei Google und OpenRouter zum Verbessern der Modelle verwendet werden.",
              ") and Ollama locally. Google and OpenRouter may use free tier content to improve their models.",
            )}
          </Alert>
        </Section>
      )}

      <Section
        title={t("KI-Anbieter", "AI provider")}
        subtitle={t(
          "Jede OpenAI-kompatible API. Key bleibt lokal auf diesem Rechner und wird nie an den Browser zurückgegeben.",
          "Any OpenAI-compatible API. The key stays local and is never sent back to the browser.",
        )}
      >
        <div className="grid-two">
          <label className="field">
            <span>{t("Basis-URL", "Base URL")}</span>
            <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.openai.com/v1" spellCheck={false} />
            <small className="muted">
              {activeProvider
                ? t(`Erkannt: ${activeProvider.name}`, `Detected: ${activeProvider.name}`)
                : t("Auch eigene Gateways und lokale Server möglich.", "Own gateways and local servers work too.")}
            </small>
          </label>

          <div className="field">
            <span>
              {t("Modell", "Model")}{" "}
              {settings && (
                <Badge tone={settings.hasApiKey ? "good" : "warn"}>
                  {settings.hasApiKey ? `Key: ${settings.apiKeySource}` : t("kein Key", "no key")}
                </Badge>
              )}
            </span>
            {visibleModels.length > 0 ? (
              <select
                value={model}
                onChange={(event) => {
                  setModel(event.target.value);
                  setMessage({
                    kind: "info",
                    text: t(`Modell gewählt: ${event.target.value} – noch speichern.`, `Model picked: ${event.target.value}, still needs saving.`),
                  });
                }}
              >
                {!visibleModels.includes(model) && <option value={model}>{model || t("– Modell wählen –", "– pick a model –")}</option>}
                {visibleModels.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                    {freeModels.includes(entry) ? t(" · kostenlos", " · free") : ""}
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
                ? t(
                    `${visibleModels.length} Modelle zur Auswahl${freeOnly ? " (nur kostenlose)" : ""}.`,
                    `${visibleModels.length} models to choose from${freeOnly ? " (free only)" : ""}.`,
                  )
                : t(
                    "Key einfügen und „Modelle laden“ – dann erscheint hier die Auswahlliste.",
                    "Add the key and press \"Load models\", then the list appears here.",
                  )}
            </small>
            {freeModels.length > 0 && (
              <label className="inline-check">
                <input type="checkbox" checked={freeOnly} onChange={(event) => setFreeOnly(event.target.checked)} />
                {t("nur kostenlose Modelle anzeigen", "show free models only")}
              </label>
            )}
          </div>

          <label className="field">
            <span>
              {t("API-Key", "API key")}{" "}
              {settings?.hasApiKey && <small className="muted">{t("(gesetzt – leer lassen zum Behalten)", "(set, leave empty to keep)")}</small>}
            </span>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              onBlur={() => {
                if (apiKey.trim() !== "" && models.length === 0) void loadModels(true);
              }}
              placeholder={activeProvider?.local ? t("nicht nötig bei lokalem Server", "not needed for a local server") : "sk-…"}
              autoComplete="off"
              spellCheck={false}
            />
            <small className="muted">
              {t(
                "Nach dem Einfügen lädt die Modellliste automatisch – oder direkt „Modelle laden“.",
                "Pasting a key loads the model list automatically, or press \"Load models\".",
              )}
            </small>
          </label>
          <div className="field align-end">
            <div className="row gap-sm wrap">
              <button className="btn" onClick={() => void loadModels()} disabled={busy !== null}>
                {busy === "models" ? <Spinner label={t("Lade…", "Loading…")} /> : t("Modelle laden", "Load models")}
              </button>
              <button className="btn" onClick={() => void checkFreeModels()} disabled={busy !== null || scanning}>
                {scanning ? <Spinner label={t("Prüfe…", "Checking…")} /> : t("Kostenlose prüfen", "Check free models")}
              </button>
            </div>
          </div>
        </div>

        {scan && (
          <div className="model-scan">
            <p className="muted small">
              {t(
                String(scan.freeCount) +
                  " kostenlose Modelle bei " +
                  scan.provider +
                  ", " +
                  String(scan.probed) +
                  " davon mit einer Anfrage von einem Token getestet. Ein Free-Tier ist kein Freibrief, die Tageslimits gelten weiter.",
                String(scan.freeCount) +
                  " free models at " +
                  scan.provider +
                  ", " +
                  String(scan.probed) +
                  " of them checked with a one-token request. A free tier still has daily limits.",
              )}
            </p>
            {scan.models
              .filter((entry) => entry.free === true)
              .slice(0, 12)
              .map((entry) => (
                <div key={entry.id} className="model-scan-row">
                  <code>{entry.id}</code>
                  <span className="muted small">{entry.note}</span>
                  <span className="row gap-sm wrap">
                    {entry.works === true && (
                      <Badge tone="good">
                        {t("antwortet", "answers")}
                        {entry.ms !== null ? ` ${entry.ms} ms` : ""}
                      </Badge>
                    )}
                    {entry.works === false && <Badge tone="warn">{t("antwortet nicht", "no answer")}</Badge>}
                    {entry.works === null && <Badge>{t("nicht getestet", "not tested")}</Badge>}
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        setModel(entry.id);
                        setMessage({
                          kind: "info",
                          text: t(`Modell ${entry.id} gewählt, noch speichern.`, `Model ${entry.id} picked, still needs saving.`),
                        });
                      }}
                    >
                      {t("verwenden", "use")}
                    </button>
                  </span>
                </div>
              ))}
            {scan.freeCount === 0 && (
              <p className="muted small">
                {t("Der Anbieter meldet kein kostenloses Modell.", "The provider reports no free model.")}
              </p>
            )}
          </div>
        )}
      </Section>

      <Section
        title={t("Scanner", "Scanner")}
        subtitle={t("Höflich bleiben: TikTok sperrt IPs, die zu schnell anfragen.", "Stay polite: TikTok blocks IPs that request too fast.")}
      >
        <div className="grid-two">
          <label className="field">
            <span>
              {t("Mindestabstand zwischen Anfragen", "Minimum delay between requests")}: {formatDecimal(delay / 1000, 1)} s
            </span>
            <input type="range" min={600} max={5000} step={100} value={delay} onChange={(event) => setDelay(Number(event.target.value))} />
            <small className="muted">
              {t(
                `20 Videos ≈ ${Math.round((20 * delay) / 1000)} s. Bei „ratelimit triggered“ erhöhen.`,
                `20 videos ≈ ${Math.round((20 * delay) / 1000)} s. Raise it when you see "ratelimit triggered".`,
              )}
            </small>
          </label>
          <label className="field">
            <span>{t("Zeitzone für „beste Posting-Zeiten“", "Timezone for the best posting times")}</span>
            <input value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="Europe/Berlin" spellCheck={false} />
          </label>
          <label className="field span-2">
            <span>
              {t("TikTok-Cookies (optional)", "TikTok cookies (optional)")} {settings?.cookieSet && <Badge tone="good">{t("gesetzt", "set")}</Badge>}
            </span>
            <textarea
              value={cookie}
              onChange={(event) => setCookie(event.target.value)}
              rows={3}
              placeholder="sessionid=…; tt_csrf_token=…"
              spellCheck={false}
            />
            <small className="muted">
              {t(
                "Nur nötig, wenn TikTok blockt. Im Browser auf tiktok.com: DevTools → Application → Cookies → sessionid kopieren.",
                "Only needed when TikTok blocks. In the browser on tiktok.com: DevTools → Application → Cookies → copy sessionid.",
              )}
            </small>
          </label>
        </div>
      </Section>

      <div className="row gap wrap">
        <button className="btn btn-primary" onClick={save} disabled={busy !== null}>
          {busy === "save" ? <Spinner label={t("Speichere…", "Saving…")} /> : t("Einstellungen speichern", "Save settings")}
        </button>
        <button className="btn" onClick={clearCache} disabled={busy !== null}>
          {t("Cache leeren", "Clear cache")}
        </button>
        <button className="btn btn-ghost" onClick={clearKey} disabled={busy !== null}>
          {t("Key & Cookie löschen", "Delete key & cookie")}
        </button>
      </div>

      {message && <Alert kind={message.kind}>{message.text}</Alert>}

      {status && (
        <Section title={t("Systemstatus", "System status")}>
          <ul className="kv">
            <li>
              <span>KI</span>
              <strong>{status.ai.configured ? `${status.ai.model} @ ${status.ai.baseUrl}` : t("nicht konfiguriert", "not configured")}</strong>
            </li>
            <li>
              <span>{t("Scanner", "Scanner")}</span>
              <strong>
                {formatDecimal(status.scraping.minDelayMs / 1000, 1)} s {t("Abstand", "delay")} · Cookie{" "}
                {status.scraping.cookieSet ? t("aktiv", "active") : t("inaktiv", "inactive")} · {status.scraping.cacheEntries}{" "}
                {t("Cache-Einträge", "cache entries")}
              </strong>
            </li>
            <li>
              <span>{t("Zeitzone", "Timezone")}</span>
              <strong>{status.timezone}</strong>
            </li>
            <li>
              <span>{t("Erreichbarkeit", "Reachability")}</span>
              <strong>
                {status.server.localOnly
                  ? t(`nur dieser Rechner (${status.server.host})`, `this computer only (${status.server.host})`)
                  : t(`im Netzwerk offen (${status.server.host})`, `open on the network (${status.server.host})`)}
              </strong>
            </li>
            <li>
              <span>Version</span>
              <strong>{status.version}</strong>
            </li>
          </ul>
          <Alert kind="warn">
            {t(
              "Automatisiertes Auslesen von TikTok-Daten widerspricht den TikTok-Nutzungsbedingungen und kann zu Sperren führen. Nutze das Tool für eigene Accounts und für öffentlich sichtbare Marktforschung, mit niedriger Frequenz und auf eigenes Risiko.",
              "Automated reading of TikTok data goes against the TikTok terms of service and can lead to blocks. Use the tool for your own accounts and publicly visible market research, at a low frequency and at your own risk.",
            )}
          </Alert>
        </Section>
      )}
    </div>
  );
}
