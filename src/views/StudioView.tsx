import { useEffect, useState } from "react";
import { ApiError, api } from "../api";
import type { AiMode, AiResponse, ScanResult, Status } from "../types";
import { Alert, Badge, Section, Spinner } from "../components/ui";
import { JsonView } from "../components/JsonView";

const MODES: { id: AiMode; label: string; description: string }[] = [
  { id: "strategy", label: "30-Tage-Strategie", description: "Positionierung, Content-Säulen, Posting-Plan, KPI-Ziele" },
  { id: "audit", label: "Profil-Audit", description: "Schwächen, Risiken und die schnellsten Wins" },
  { id: "ideas", label: "Video-Ideen", description: "Ideen mit Hook, Drehbuch in Sekunden und CTA" },
  { id: "caption", label: "Captions", description: "Fertige Captions mit Hashtags und On-Screen-Text" },
  { id: "hooks", label: "Hooks", description: "Sätze für die ersten 2 Sekunden" },
  { id: "calendar", label: "7-Tage-Plan", description: "Konkrete Uploads mit Uhrzeit und Format" },
];

const TONES = ["direkt", "humorvoll", "warm & persönlich", "sachlich & expertig", "frech", "emotional"];
const GOALS = ["Follower gewinnen", "Reichweite / Views", "Interaktion", "Saves & Shares", "Produkte verkaufen"];

export function StudioView({ scan, status, initialMode }: { scan: ScanResult | null; status: Status | null; initialMode: AiMode }) {
  const [mode, setMode] = useState<AiMode>(initialMode);
  const [topic, setTopic] = useState("");
  const [niche, setNiche] = useState("");
  const [tone, setTone] = useState(TONES[0]);
  const [goal, setGoal] = useState(GOALS[0]);
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; hint: string } | null>(null);
  const [response, setResponse] = useState<AiResponse | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => setMode(initialMode), [initialMode]);

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

  return (
    <div className="stack">
      <Section title="KI-Studio" subtitle="Texte und Strategie auf Basis deiner gescrapten TikTok-Zahlen">
        <div className={`context-banner ${scan?.metrics.hasData ? "ok" : "missing"}`}>
          {scan ? (
            <>
              <Badge tone={scan.metrics.hasData ? "good" : "warn"}>
                {scan.metrics.hasData ? "Mit echten Daten" : "Nur Profil-Stats"}
              </Badge>
              <span>
                Kontext: <strong>@{scan.profile.handle}</strong> · {scan.metrics.sampleSize} Videos · Score {scan.metrics.score ?? "–"}/100
              </span>
            </>
          ) : (
            <>
              <Badge tone="warn">Kein Scan</Badge>
              <span>Die KI antwortet ohne Messdaten. Für fundierte Tipps zuerst im Tab „Scan“ einen Account analysieren.</span>
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
                <strong>{entry.label}</strong>
                <span>{entry.description}</span>
              </button>
            ))}
          </div>

          <div className="grid-two">
            <label className="field">
              <span>Thema / konkretes Video</span>
              <input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="z. B. 3 Fehler beim Abnehmen ohne Sport"
              />
            </label>
            <label className="field">
              <span>Nische (falls kein Scan)</span>
              <input value={niche} onChange={(event) => setNiche(event.target.value)} placeholder="z. B. Fitness für Berufstätige" />
            </label>
            <label className="field">
              <span>Tonalität</span>
              <select value={tone} onChange={(event) => setTone(event.target.value)}>
                {TONES.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Ziel</span>
              <select value={goal} onChange={(event) => setGoal(event.target.value)}>
                {GOALS.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Anzahl Ergebnisse</span>
              <input type="number" min={1} max={20} value={count} onChange={(event) => setCount(Number(event.target.value) || 5)} />
            </label>
            <div className="field align-end">
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? <Spinner label="KI arbeitet…" /> : activeMode?.label}
              </button>
            </div>
          </div>

          {status && !status.ai.configured && (
            <Alert kind="info">
              Kein KI-Key hinterlegt. Trage ihn unter „Einstellungen“ ein – z. B. einen OpenAI-, OpenRouter- oder Freebuff-Key.
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
          <Spinner label="Die KI schreibt – das dauert 10 bis 40 Sekunden…" />
        </Section>
      )}

      {response && (
        <Section
          title={activeMode?.label}
          subtitle={`Modell: ${response.model}${response.parsed ? "" : " · Antwort war kein valides JSON, wird als Text angezeigt"}`}
          actions={
            <button className="btn btn-ghost" onClick={copy}>
              {copied ? "Kopiert" : "Als JSON kopieren"}
            </button>
          }
        >
          <JsonView data={response.result} />
        </Section>
      )}
    </div>
  );
}
