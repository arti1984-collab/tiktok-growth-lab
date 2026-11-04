import { useEffect, useState } from "react";
import { ApiError, api } from "../api";
import { useLang, useT } from "../lang";
import type { AiMode, AiResponse, ScanResult, Status } from "../types";
import { Alert, Badge, Section, Spinner } from "../components/ui";
import { JsonView } from "../components/JsonView";
import { WeekPlan } from "../components/WeekPlan";
import { buildTextExport, downloadTextFile, textFilename } from "../textExport";

const MODES: { id: AiMode; de: [string, string]; en: [string, string] }[] = [
  { id: "strategy", de: ["30-Tage-Strategie", "Positionierung, Content-Säulen, Posting-Plan, KPI-Ziele"], en: ["30-day strategy", "Positioning, content pillars, posting plan, KPI targets"] },
  { id: "audit", de: ["Profil-Audit", "Schwächen, Risiken und die schnellsten Wins"], en: ["Profile audit", "Weak spots, risks and the quickest wins"] },
  { id: "ideas", de: ["Video-Ideen", "Ideen mit Hook, Drehbuch in Sekunden und CTA"], en: ["Video ideas", "Ideas with hook, a script in seconds and a call to action"] },
  { id: "caption", de: ["Captions", "Fertige Captions mit Hashtags und On-Screen-Text"], en: ["Captions", "Ready captions with hashtags and on-screen text"] },
  { id: "hooks", de: ["Hooks", "Sätze für die ersten 2 Sekunden"], en: ["Hooks", "Lines for the first 2 seconds"] },
  { id: "calendar", de: ["7-Tage-Plan", "Konkrete Uploads mit Uhrzeit und Format"], en: ["7-day plan", "Concrete uploads with time and format"] },
  { id: "hashtags", de: ["Hashtags", "Tag-Sets für Nische, Reichweite und Marke"], en: ["Hashtags", "Tag sets for niche, reach and brand"] },
];

const TONES = [
  { de: "direkt", en: "direct" },
  { de: "humorvoll", en: "humorous" },
  { de: "warm & persönlich", en: "warm and personal" },
  { de: "sachlich & expertig", en: "factual and expert" },
  { de: "frech", en: "cheeky" },
  { de: "emotional", en: "emotional" },
];

const GOALS = [
  { de: "Follower gewinnen", en: "gain followers" },
  { de: "Reichweite / Views", en: "reach and views" },
  { de: "Interaktion", en: "interaction" },
  { de: "Saves & Shares", en: "saves and shares" },
  { de: "Produkte verkaufen", en: "sell products" },
];

export function StudioView({ scan, status, initialMode }: { scan: ScanResult | null; status: Status | null; initialMode: AiMode }) {
  const t = useT();
  const lang = useLang();
  const [mode, setMode] = useState<AiMode>(initialMode);
  const [topic, setTopic] = useState("");
  const [niche, setNiche] = useState("");
  const toneOptions = TONES.map((entry) => (lang === "en" ? entry.en : entry.de));
  const goalOptions = GOALS.map((entry) => (lang === "en" ? entry.en : entry.de));
  const [tone, setTone] = useState(toneOptions[0]);
  const [goal, setGoal] = useState(goalOptions[0]);
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; hint: string } | null>(null);
  const [response, setResponse] = useState<AiResponse | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => setMode(initialMode), [initialMode]);

  // After switching the language the old value no longer exists in the list.
  useEffect(() => {
    if (!toneOptions.includes(tone)) setTone(toneOptions[0]);
    if (!goalOptions.includes(goal)) setGoal(goalOptions[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    setCopied(false);
    try {
      const data = await api.ai({
        mode,
        handle: scan?.profile.handle,
        payload: { topic, niche, tone, goal, count },
      });
      setResponse(data);
    } catch (caught) {
      const apiError = caught as ApiError;
      setError({ message: apiError.message, hint: apiError.hint });
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!response) return;
    await navigator.clipboard.writeText(JSON.stringify(response.result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const activeMode = MODES.find((entry) => entry.id === mode);
  const activeLabel = activeMode ? (lang === "en" ? activeMode.en[0] : activeMode.de[0]) : undefined;

  function saveText() {
    if (!response) return;
    const title = activeLabel ?? t("KI-Antwort", "AI answer");
    downloadTextFile(
      textFilename(title),
      buildTextExport({ title, model: response.model, handle: scan?.profile.handle, result: response.result }),
    );
  }

  return (
    <div className="stack">
      <Section
        title={t("KI-Studio", "AI studio")}
        subtitle={t(
          "Texte und Strategie auf Basis deiner gescrapten TikTok-Zahlen",
          "Copy and strategy based on your scraped TikTok numbers",
        )}
      >
        <div className={`context-banner ${scan?.metrics.hasData ? "ok" : "missing"}`}>
          {scan ? (
            <>
              <Badge tone={scan.metrics.hasData ? "good" : "warn"}>
                {scan.metrics.hasData ? t("Mit echten Daten", "With real data") : t("Nur Profil-Stats", "Profile stats only")}
              </Badge>
              <span>
                {t("Kontext", "Context")}: <strong>@{scan.profile.handle}</strong> · {scan.metrics.sampleSize} {t("Videos", "videos")} ·{" "}
                {t("Score", "score")} {scan.metrics.score ?? "–"}/100
              </span>
            </>
          ) : (
            <>
              <Badge tone="warn">{t("Kein Scan", "No scan")}</Badge>
              <span>
                {t(
                  "Die KI antwortet ohne Messdaten. Für fundierte Tipps zuerst im Tab „Scan“ einen Account analysieren.",
                  "The AI answers without measured data. For grounded tips, analyse an account in the Scan tab first.",
                )}
              </span>
            </>
          )}
        </div>

        <form className="stack" onSubmit={generate}>
          <div className="mode-grid">
            {MODES.map((entry) => (
              <button
                type="button"
                key={entry.id}
                className={`mode-tile ${mode === entry.id ? "active" : ""}`}
                onClick={() => setMode(entry.id)}
              >
                <strong>{lang === "en" ? entry.en[0] : entry.de[0]}</strong>
                <span>{lang === "en" ? entry.en[1] : entry.de[1]}</span>
              </button>
            ))}
          </div>

          <div className="grid-two">
            <label className="field">
              <span>{t("Thema / konkretes Video", "Topic / specific video")}</span>
              <input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder={t("z. B. 3 Fehler beim Abnehmen ohne Sport", "for example 3 mistakes when losing weight without sport")}
              />
            </label>
            <label className="field">
              <span>
                {mode === "hashtags"
                  ? t("Nische oder Thema für die Hashtags", "Niche or topic for the hashtags")
                  : t("Nische (falls kein Scan)", "Niche (if there is no scan)")}
              </span>
              <input
                value={niche}
                onChange={(event) => setNiche(event.target.value)}
                placeholder={t("z. B. Fitness für Berufstätige", "for example fitness for office workers")}
              />
            </label>
            <label className="field">
              <span>{t("Tonalität", "Tone")}</span>
              <select value={tone} onChange={(event) => setTone(event.target.value)}>
                {toneOptions.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t("Ziel", "Goal")}</span>
              <select value={goal} onChange={(event) => setGoal(event.target.value)}>
                {goalOptions.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t("Anzahl Ergebnisse", "Number of results")}</span>
              <input type="number" min={1} max={20} value={count} onChange={(event) => setCount(Number(event.target.value) || 5)} />
            </label>
            <div className="field align-end">
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? <Spinner label={t("KI arbeitet…", "AI is working…")} /> : activeLabel}
              </button>
            </div>
          </div>

          {status && !status.ai.configured && (
            <Alert kind="info">
              {t(
                "Kein KI-Key hinterlegt. Trage ihn unter „Einstellungen“ ein – z. B. einen OpenAI-, OpenRouter- oder Freebuff-Key.",
                "No AI key stored. Add one in the settings, for example an OpenAI, OpenRouter or Freebuff key.",
              )}
            </Alert>
          )}

          {error && (
            <Alert kind="error">
              <strong>{error.message}</strong>
              {error.hint && <div className="small">{error.hint}</div>}
            </Alert>
          )}
        </form>
      </Section>

      {loading && (
        <Section>
          <Spinner
            label={t("Die KI schreibt – das dauert 10 bis 40 Sekunden…", "The AI is writing, this takes 10 to 40 seconds…")}
          />
        </Section>
      )}

      {response && (
        <Section
          title={activeLabel}
          subtitle={`${t("Modell", "Model")}: ${response.model}${
            response.parsed ? "" : t(" · Antwort war kein valides JSON, wird als Text angezeigt", " · the answer was not valid JSON, shown as text")
          }`}
          actions={
            <>
              <button className="btn btn-ghost" onClick={saveText}>
                {t("Als Textdatei speichern", "Save as text file")}
              </button>
              <button className="btn btn-ghost" onClick={copy}>
                {copied ? t("Kopiert", "Copied") : t("Als JSON kopieren", "Copy as JSON")}
              </button>
            </>
          }
        >
          {response.mode === "calendar" && Array.isArray((response.result as { tage?: unknown })?.tage) ? (
            <WeekPlan days={(response.result as { tage: unknown[] }).tage} />
          ) : (
            <JsonView data={response.result} />
          )}
        </Section>
      )}
    </div>
  );
}
